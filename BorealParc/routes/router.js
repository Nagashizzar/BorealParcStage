var express = require('express');
var router = express.Router();
var passport = require('passport');
var flash = require('connect-flash');
require('../public/passport')(passport);
var multer = require('multer');
var path = require('path');
var fs = require('fs');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/images/map/'))
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '.jpg')
    }
});

var upload = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if (ext !== '.jpg') {
            return callback(new Error('Only jpg images are allowed'))
        }
        callback(null, true)
    },
    limits: {
        fileSize: 10000000,
        files: 1
    }
}).single('borealmap');

var mongoose = require('mongoose');

var User = require('../public/schema/UserSchema');
//////////////////////////
/// Section principale ///
//////////////////////////
router.get('/', function (req, res, next) {
    User.find({
        isSuperAdmin: false
    }, function (err, user) {
        if (err)
            return done(err);
        else if (!user)
            res.render('index', {
                title: 'Accueil - Boréal Parc'
            });
        else
            res.render('index', {
                title: 'Accueil - Boréal Parc',
                entreprise: user,
                isLog: req.user
            });
    }).sort({
        companyName: 1
    })
});
//////////////////////////
/// Section entreprise ///
//////////////////////////
//administation shoudn't be displayed
router.get('/entreprise/administration', function (req, res, next) {
    res.redirect('/');
})
router.get('/entreprise/:companyNameSlug', function (req, res, next) {
    User.findOne({
        'companyNameSlug': req.params.companyNameSlug
    }, function (err, user) {
        if (err)
            return done(err);
        else if (!user)
            res.redirect('/');
        else res.render('entreprise', {
            title: user.companyName,
            entreprise: user,
            isLog: req.user
        });
    })
})
/////////////////////////////////////
/// Login/Register/Logout Section ///
/////////////////////////////////////
router.get('/login', function (req, res, next) {
    res.render('login', {
        title: 'Login',
        message: req.flash('loginMessage')
    });
});

router.post('/login', passport.authenticate('local-login', {
    successRedirect: '/dashboard',
    failureRedirect: 'login',
    failureFlash: true
}));

router.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/')
});

/////////////////////////////////////
/// Section Dashboard SUPER-ADMIN ///
/////////////////////////////////////
//Affichage de la liste des entreprises
router.get('/dashboard', isSuperAdmin, function (req, res) {
    User.find({
            isSuperAdmin: false
        })
        .then(function (doc) {
            res.render('admin/dashboard.superadmin-home.hbs', {
                title: 'Dashboard SuperAdmin',
                message: req.flash('signupMessage'),
                isLog: req.user,
                items: doc
            });
        });
});
//Affichage de l'entreprise à modifier
router.get('/dashboard/update/:id', isSuperAdmin, function (req, res, next) {
    var mongoId = mongoose.Types.ObjectId(req.params.id);
    User.findById(mongoId, function (err, doc) {
        if (err) {
            return done(err);
        } else {
            res.render('admin/dashboard.superadmin-shop-content.hbs', {
                title: 'Modification magasin - Dashboard SuperAdmin',
                isLog: req.user,
                success: req.session.success,
                errors: req.session.errors,
                item: doc
            });
            req.session.success = false;
            req.session.errors = null;
        }
    })
});
//Modification de l'entreprise
router.post('/dashboard/update', isSuperAdmin, function (req, res, next) {
    req.check('presentation', 'La présentation est vide').notEmpty();
    req.check('website', 'Le format du lien du site n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('facebook', 'Le format du lien facebook n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('twitter', 'Le format du lien twitter n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('instagram', 'Le format du lien instagram n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('leftIndicator', 'Le positionnement horizontal doit être un chiffre').optional({
        checkFalsy: true
    }).isInt();
    req.check('rightIndicator', 'Le positionnement vertical doit être un chiffre').optional({
        checkFalsy: true
    }).isInt();
    req.check('leftIndicator', 'Le positionnement horizontal doit être compris entre 0 et 100').optional({
        checkFalsy: true
    }).isIntRange(0, 100);
    req.check('rightIndicator', 'Le positionnement vertical doit être compris entre 0 et 100').optional({
        checkFalsy: true
    }).isIntRange(0, 100);
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
    } else {
        User.findById(req.body.id, function (err, doc) {
            if (err) {
                return done(err);
            }
            doc.page.presentation = req.body.presentation;
            doc.page.address = req.body.address;
            doc.page.contact.website = req.body.website;
            doc.page.contact.facebook = req.body.facebook;
            doc.page.contact.twitter = req.body.twitter;
            doc.page.contact.instagram = req.body.instagram;
            doc.page.schedule = req.body.schedule;
            doc.leftIndicator = req.body.leftIndicator;
            doc.rightIndicator = req.body.rightIndicator;
            doc.save();
        })
        req.session.success = true;
    }
    res.redirect("/dashboard/update/" + req.body.id);
});

router.post('/dashboard/modification-mot-de-passe-magasin', isLoggedIn, function (req, res) {
    req.check('oldPassword', 'L\' ancien mot de passe est invalide').isValidPassword(req.user.user.password);
    req.check('newPassword', 'Le champ nouveau mot de passe est vide').notEmpty();
    req.check('newPassword', 'Le mot de passe doit posséder au minimum 6 caractères').len(6, 20);
    req.check('newPassword', 'Les mots de passe ne sont pas identiques').isEqual(req.body.newPasswordVerification);
    req.check('newPasswordVerification', 'La verification du mot de passe est vide').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
        res.redirect('/dashboard/modification-mot-de-passe-magasin');
    } else {
        User.findById(req.session.passport.user, function (err, user) {
            if (err) return done(err);
            user.user.password = user.generateHash(req.body.newPassword);
            user.save(function (err, updatedTank) {
                if (err) return done(err);
                req.session.success = true;
                res.redirect('/dashboard/modification-mot-de-passe-magasin');
            });
        });
    }
});

//Modification des informations du compte entreprise
router.get('/dashboard/shop-update/:id', isSuperAdmin, function (req, res, next) {
    var mongoId = mongoose.Types.ObjectId(req.params.id);
    User.findById(mongoId, function (err, doc) {
        if (err) {
            return done(err);
        } else {
            res.render('admin/dashboard.superadmin-shop-account-modification.hbs', {
                title: 'Modification compte - Dashboard SuperAdmin',
                isLog: req.user,
                success: req.session.success,
                errors: req.session.errors,
                item: doc
            });
            req.session.success = false;
            req.session.errors = null;
        }
    })
});
router.post('/dashboard/shop-update', isSuperAdmin, function (req, res, next) {
    req.check('mail', 'Le format de l\'email n\'est pas correct').notEmpty().isEmail();
    req.check('newPassword', 'Le champ nouveau mot de passe est vide').optional({
        checkFalsy: true
    }).notEmpty();
    req.check('newPassword', 'Le mot de passe doit posséder au minimum 6 caractères').optional({
        checkFalsy: true
    }).len(6, 20);
    req.check('newPassword', 'Les mots de passe ne sont pas identiques').isEqual(req.body.newPasswordVerification);
    req.check('newPasswordVerification', 'La verification du mot de passe est vide').optional({
        checkFalsy: true
    }).notEmpty();
    req.check('companyName', 'Le champ nom d\'entreprise est vide').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
    } else {
        User.findById(req.body.id, function (err, doc) {
            if (err) {
                return done(err);
            }
            doc.mail = req.body.mail;
            doc.user.password = doc.generateHash(req.body.newPassword);
            doc.user.login = req.body.login;
            doc.companyName = req.body.companyName;
            doc.companyNameSlug = stringToSlug(req.body.companyName);
            doc.save();
        })
        req.session.success = true;
    }
    res.redirect("/dashboard/shop-update/" + req.body.id);
});

router.post('/dashboard/update/logo', isSuperAdmin, function (req, res, next) {
    var storageLogo = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../public/images/logo/'))
        },
        filename: function (req, file, cb) {
            var logoName = req.body.companyNameSlug + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1];
            cb(null, logoName)
        }
    });
    var uploadLogo = multer({
        storage: storageLogo,
        fileFilter: function (req, file, callback) {
            var ext = path.extname(file.originalname);
            if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
                return callback(new Error('Only images are allowed'))
            }
            callback(null, true)
        },
        limits: {
            fileSize: 10000000,
            files: 1
        }
    }).single('logo');
    mongoId = mongoose.Types.ObjectId(req.body.id);
    uploadLogo(req, res, function (err) {
        mongoId = mongoose.Types.ObjectId(req.body.id);
        User.findById(mongoId, function (err, doc) {
            if (err) {
                return done(err);
            }
            doc.logo = req.file.filename;
            doc.save();
            res.redirect("/dashboard/update/" + mongoId);
        });
    });
});

//Suppression entreprises
router.get('/dashboard/delete/:id', function (req, res, next) {
    User.findById(req.params.id, function (err, doc) {
        if (err) {
            return done(err);
        }
        if (doc.logo != "") {
            //On teste si l'image n'existe pas dans d'autres formats et on les supprimes
            var logoPathJpg = path.join(__dirname, '../public/images/logo/') + doc.logo.split('.')[doc.logo.split('.').length - 2] + '.jpg';
            var logoPathPng = path.join(__dirname, '../public/images/logo/') + doc.logo.split('.')[doc.logo.split('.').length - 2] + '.png';
            var logoPathJpeg = path.join(__dirname, '../public/images/logo/') + doc.logo.split('.')[doc.logo.split('.').length - 2] + '.jpeg';
            var ext = [logoPathJpg, logoPathPng, logoPathJpeg];
            var deletion = function (extension, userId, next) {
                ext.forEach(function (element) {
                    if (fs.existsSync(element)) {
                        fs.unlinkSync(element);
                    }
                });
                next(userId);
            };
            //next() doit être exécuté après sinon node cherche à supprimer une référence d'image qui n'existe déjà plus
            deletion(ext, req.params.id, function (mongoId) {
                User.findByIdAndRemove(mongoId).exec();
                res.redirect('/dashboard');
            });
        } else {
            User.findByIdAndRemove(req.params.id).exec();
            res.redirect('/dashboard');
        }
    });
});
//La création d'un compte magasin doit nécessairement passer par ici, la magasin recevra ses identifiants depuis le super-administrateur et pourra 
//modifier son mot de passe par la suite
router.get('/dashboard/creation-compte-magasin', isSuperAdmin, function (req, res) {
    res.render('admin/dashboard.superadmin-shop-account-creation.hbs', {
        title: 'Création compte magasin - Dashboard SuperAdmin',
        isLog: req.user,
        success: req.session.success,
        errors: req.session.errors,
        lastPostItem: req.session.lastPostItem
    });
    req.session.success = false;
    req.session.errors = null;
    req.session.lastPostItem = null;
});
router.post('/dashboard/creation-compte-magasin', isSuperAdmin, function (req, res) {
    req.check('companyName', 'Le nom de l\'entreprise est vide').notEmpty();
    req.check('login', 'Le login est vide').notEmpty();
    req.check('mail', 'L\'email de l\'entreprise est vide').notEmpty();
    req.check('mail', 'Le format de l\'email n\'est pas correct').isEmail();
    req.check('password', 'Le mot de passe est vide').notEmpty();
    req.check('password', 'Le mot de passe doit posséder au minimum 6 caractères').len(6, 20);
    req.check('password', 'Les mots de passe ne sont pas identiques').isEqual(req.body.passwordVerification);
    req.check('passwordVerification', 'La verification du mot de passe est vide').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
        var lastPostItem = {
            companyName: req.body.companyName,
            login: req.body.login,
            mail: req.body.mail
        };
        req.session.lastPostItem = lastPostItem;
    } else {
        //Create a new item inside the database
        var newUser = new User();
        newUser.user.login = req.body.login;
        newUser.user.password = newUser.generateHash(req.body.password);
        newUser.mail = req.body.mail;
        newUser.companyName = req.body.companyName;
        newUser.companyNameSlug = stringToSlug(req.body.companyName);
        newUser.logo = "";
        newUser.isSuperAdmin = false;
        newUser.save(function (err) {
            if (err) {
                return done(err);
            }
        });
        req.session.success = true;
    }
    res.redirect('/dashboard/creation-compte-magasin');
});

router.get('/dashboard/modification-elements-site', isSuperAdmin, function (req, res) {
    res.render('admin/dashboard.superadmin-site-modification.hbs', {
        title: 'Modification élément site - Dashboard SuperAdmin',
        isLog: req.user,
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.success = false;
    req.session.errors = null;
});
router.post('/dashboard/modification-elements-site', isSuperAdmin, function (req, res) {
    upload(req, res, function (err) {
        if (err) {
            return
        }
    });
    res.redirect('/dashboard/modification-elements-site');
});
//Section modification du mot de passe superadmin
router.get('/dashboard/modification-mot-de-passe-superadmin', isSuperAdmin, function (req, res) {
    res.render('admin/dashboard.superadmin-password.hbs', {
        title: 'Modification mot de passe - Dashboard SuperAdmin',
        isLog: req.user,
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.success = false;
    req.session.errors = null;
});
router.post('/dashboard/modification-mot-de-passe-superadmin', isSuperAdmin, function (req, res) {
    //TODO verifier que l'ancien mot de passe rentré par l'utilisateur est bien le bon
    req.check('oldPassword', 'L\' ancien mot de passe est invalide').isValidPassword(req.user.user.password);
    req.check('newPassword', 'Le champ nouveau mot de passe est vide').notEmpty();
    req.check('newPassword', 'Le mot de passe doit posséder au minimum 6 caractères').len(6, 20);
    req.check('newPassword', 'Les mots de passe ne sont pas identiques').isEqual(req.body.newPasswordVerification);
    req.check('newPasswordVerification', 'La verification du mot de passe est vide').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
        res.redirect('/dashboard/modification-mot-de-passe-superadmin');
    } else {
        User.findById(req.session.passport.user, function (err, user) {
            if (err) return done(err);
            user.user.password = user.generateHash(req.body.newPassword);
            user.save(function (err, updatedTank) {
                if (err) return done(err);
                req.session.success = true;
                res.redirect('/dashboard/modification-mot-de-passe-superadmin');
            });
        });
    }
});

/////////////////////////////////
/// Section Dashboard MAGASIN ///
/////////////////////////////////
router.get('/dashboard/modification-mot-de-passe-magasin', isLoggedIn, function (req, res) {
    res.render('admin/dashboard.shopadmin-password.hbs', {
        title: 'Modification mot de passe - Dashboard Magasin',
        isLog: req.user,
        success: req.session.success,
        errors: req.session.errors
    });
    req.session.success = false;
    req.session.errors = null;
});
router.post('/dashboard/modification-mot-de-passe-magasin', isLoggedIn, function (req, res) {
    req.check('oldPassword', 'L\' ancien mot de passe est invalide').isValidPassword(req.user.user.password);
    req.check('newPassword', 'Le champ nouveau mot de passe est vide').notEmpty();
    req.check('newPassword', 'Le mot de passe doit posséder au minimum 6 caractères').len(6, 20);
    req.check('newPassword', 'Les mots de passe ne sont pas identiques').isEqual(req.body.newPasswordVerification);
    req.check('newPasswordVerification', 'La verification du mot de passe est vide').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
        res.redirect('/dashboard/modification-mot-de-passe-magasin');
    } else {
        User.findById(req.session.passport.user, function (err, user) {
            if (err) return done(err);
            user.user.password = user.generateHash(req.body.newPassword);
            user.save(function (err, updatedTank) {
                if (err) return done(err);
                req.session.success = true;
                res.redirect('/dashboard/modification-mot-de-passe-magasin');
            });
        });
    }
});

router.get('/dashboard/contenu-magasin', isLoggedIn, function (req, res) {
    var mongoId = mongoose.Types.ObjectId(req.user._id);
    User.findById(mongoId, function (err, doc) {
        if (err) {
            return done(err);
        } else {
            res.render('admin/dashboard.shopadmin-shop-content.hbs', {
                title: 'Modification magasin - Dashboard Magasin',
                isLog: req.user,
                success: req.session.success,
                errors: req.session.errors,
                item: doc
            });
            req.session.success = false;
            req.session.errors = null;
        }
    })
});

router.post('/dashboard/contenu-magasin/logo', isLoggedIn, function (req, res) {
    var storageLogo = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../public/images/logo/'))
        },
        filename: function (req, file, cb) {
            var logoName = req.body.companyNameSlug + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1];
            cb(null, logoName)
        }
    });
    var uploadLogo = multer({
        storage: storageLogo,
        fileFilter: function (req, file, callback) {
            var ext = path.extname(file.originalname);
            if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
                return callback(new Error('Only images are allowed'))
            }
            callback(null, true)
        },
        limits: {
            fileSize: 10000000,
            files: 1
        }
    }).single('logo');
    mongoId = mongoose.Types.ObjectId(req.body.id);
    uploadLogo(req, res, function (err) {
        mongoId = mongoose.Types.ObjectId(req.body.id);
        User.findById(mongoId, function (err, doc) {
            if (err) {
                return done(err);
            }
            doc.logo = req.file.filename;
            doc.save();
            res.redirect("/dashboard/contenu-magasin");
        });
    });
});
router.post('/dashboard/contenu-magasin', isLoggedIn, function (req, res) {
    req.check('presentation', 'La présentation est vide').notEmpty();
    req.check('website', 'Le format du lien du site n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('facebook', 'Le format du lien facebook n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('twitter', 'Le format du lien twitter n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('instagram', 'Le format du lien instagram n\'est pas correct').optional({
        checkFalsy: true
    }).isURL();
    req.check('leftIndicator', 'Le positionnement horizontal doit être un chiffre').optional({
        checkFalsy: true
    }).isInt();
    req.check('rightIndicator', 'Le positionnement vertical doit être un chiffre').optional({
        checkFalsy: true
    }).isInt();
    req.check('leftIndicator', 'Le positionnement horizontal doit être compris entre 0 et 100').optional({
        checkFalsy: true
    }).isIntRange(0, 100);
    req.check('rightIndicator', 'Le positionnement vertical doit être compris entre 0 et 100').optional({
        checkFalsy: true
    }).isIntRange(0, 100);
    var errors = req.validationErrors();
    if (errors) {
        req.session.errors = errors;
        req.session.success = false;
    } else {
        User.findById(req.body.id, function (err, doc) {
            if (err) {
                return done(err);
            }
            doc.page.presentation = req.body.presentation;
            doc.page.address = req.body.address;
            doc.page.contact.website = req.body.website;
            doc.page.contact.facebook = req.body.facebook;
            doc.page.contact.twitter = req.body.twitter;
            doc.page.contact.instagram = req.body.instagram;
            doc.page.schedule = req.body.schedule;
            doc.leftIndicator = req.body.leftIndicator;
            doc.rightIndicator = req.body.rightIndicator;
            doc.save();
        })
        req.session.success = true;
    }
    res.redirect("/dashboard/contenu-magasin");
});

router.post('/dashboard/creation-compte-magasin', isSuperAdmin, passport.authenticate('local-signup', {
    successRedirect: '/dashboard',
    successFlash: true,
    failureRedirect: '/dashboard',
    failureFlash: true
}));

router.get('/*', function (req, res, next) {
    User.find({
        isSuperAdmin: false
    }, function (err, user) {
        if (err)
            return done(err);
        else if (!user)
            res.render('E404', {
                title: 'Page Introuvable',
                message: 'Nous somme désolé mais la page que vous cherchez semble introuvable'
            });
        else
            res.render('E404', {
                title: 'Page Introuvable',
                message: 'Nous somme désolé mais la page que vous cherchez semble introuvable',
                entreprise: user,
                isLog: req.user
            });
    }).sort({
        companyName: 1
    })
});

/// Custom functions ///
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function isSuperAdmin(req, res, next) {
    isLoggedIn(req, res, function () {
        if (req.user.isSuperAdmin == true) {
            return next();
        } else {
            res.render('admin/dashboard.shopadmin-home.hbs', {
                title: 'Dashboard Magasin',
                isLog: req.user
            });
        }
    })
}


function stringToSlug(str) {
    str = str.replace(/^\s+|\s+$/g, '');
    str = str.toLowerCase();
    var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
    var to = "aaaaeeeeiiiioooouuuunc------";
    for (var i = 0, l = from.length; i < l; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }
    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes
    return str;
}
module.exports = router;
