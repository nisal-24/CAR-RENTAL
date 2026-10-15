const path = require('path');
const router = require('express').Router();
const { pageGuard } = require('../middleware/auth');

const view = (name) => (req, res) => res.sendFile(path.join(__dirname, '..', 'views', `${name}.html`));

router.get('/', view('index'));
router.get('/login', view('login'));
router.get('/register', view('register'));
router.get('/my-rentals', pageGuard(), view('my-rentals'));
router.get('/admin', pageGuard('admin'), view('admin'));

module.exports = router;
