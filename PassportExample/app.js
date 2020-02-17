// Express 기본 모듈 불러오기
var express = require('express');
var http = require('http');
var path = require('path');

// Express 미들웨어 불러오기
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var static = require('serve-static');
var errorHandler = require('errorhandler');

// 오류 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// Session 미들웨어 불러오기
var expressSession = require('express-session');

// 몽고디비 모듈 사용
var MongoClient = require('mongodb').MongoClient;

// mongoose 모듈 불러오기
var mongoose = require('mongoose');

// 설정 관련 모듈 불러오기
var config = require('./config');
var database_loader = require('./database/database');
var route_loader = require('./routes/route_loader');

// Passport 사용
var passport = require('passport');
var flash = require('connect-flash');

// 데이터베이스 객체를 위한 변수 선언
var database;

// 데이터베이스 스키마 객체를 위한 변수 선언
var UserSchema;

// 데이터베이스 모델 객체를 위한 변수 선언
var UserModel;

// 익스프레스 객체 생성
var app = express();

// 기본 속성 설정
app.set('port', process.env.PORT || 3000);
app.set('database', database);

// 뷰 엔진 설정
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
console.log('뷰 엔진이 ejs로 설정되었습니다.');

// body-parser를 사용해 application/x-www-form-urlencoded 파싱
app.use(bodyParser.urlencoded({ extended: false }));

// body-parser를 사용해 application/json 파싱
app.use(bodyParser.json());

// public 폴더를 static으로 오픈
app.use('/public', static(path.join(__dirname, 'public')));

// cookie-parser 설정
app.use(cookieParser());

// 세션 설정
app.use(expressSession({
	secret: 'my key',
	resave: true,
	saveUninitialized: true
}));

// Passport 사용 설정
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

var LocalStrategy = require('passport-local').Strategy;

// 패스포트 로그인 설정
passport.use('local-login', new LocalStrategy({
	usernameField: 'email',
	passwordField: 'password',
	passReqToCallback: true
}, function(req, email, password, done) {
	console.log('passport의 local-login 호출됨: ' + email + ', ' + password);

	var database = app.get('database');
	database.UserModel.findOne({'email': email}, function(err, user) {
		if (err) {return done(err);}

		// 등록된 사용자가 없는 경우
		if (!user) {
			console.log('계정이 일치하지 않음.');
			return done(null, false, req.flash('loginMessage', '등록된 계정이 없습니다.'));
		}

		// 비밀번호를 비교하여 맞지 않는 경우
		var authenticated = user.authenticate(password, user._doc.salt,
									user._doc.hashed_password);
		if (!authenticated) {
			console.log('비밀번호 일치하지 않음.');
			return done(null, false, req.flash('loginMessage', '비밀번호가 일치하지 않습니다.'));
		}
			
		// 정상인 경우
		console.log('계정과 비밀번호가 일치함.');
		return done(null, user);
	});
}));

// 패스포트 회원가입 설정
passport.use('local-signup', new LocalStrategy({
	usernameField: 'email',
	passwordField: 'password',
	passReqToCallback: true
}, function(req, email, password, done) {
	// name 파라미터 확인
	var paramName = req.body.name || req.query.name;
	console.log('passport의 local-signup 호출됨: ' + email + ', ' + password + ', '
				+ paramName);

	// User.findOne을 async 방식으로 변경 (blocking 될수 있음)
	process.nextTick(function() {
		var database = app.get('database');
		database.UserModel.findOne({'email': email}, function(err, user) {
			// 오류 발생
			if (err) {
				return done(err);
			}

			// 기존 이메일 존재
			if (user) {
				console.log('기존에 계정이 있음.');
				return done(null, false, req.flash('signupMessage', '계정이 이미 있습니다.'));
			}
			else {
				// 모델 인스턴스 객체를 만들어 저장
				var user = new database.UserModel({'email': email, 'password': password,
													'name': paramName});
				user.save(function(err) {
					if (err) {throw err;}
					console.log('사용자 데이터 추가함.');
					return done(null, user);
				});
			}
		});
	});
}));

// 사용자 인증 성공
passport.serializeUser(function(user, done) {
	console.log('serializeUser() 호출됨.');
	console.dir(user);

	done(null, user);
});

// 사용자 인증 이후 사용자 요청
passport.deserializeUser(function(user, done) {
	console.log('deserializeUser() 호출됨.');
	console.dir(user);

	done(null, user);
});

// 라우팅 설정
var router = express.Router();
route_loader.init(app, router);

// 홈 화면
router.route('/').get(function(req, res) {
	console.log('/ 패스 요청됨.');
	res.render('index.ejs');
});

// 프로필 화면 - 로그인 여부 확인
router.route('/profile').get(function(req, res) {
	console.log('/profile 패스 요청됨.');

	// 인증된 경우 사용자 정보 확인 가능
	console.log('req.user 객체 값');
	console.dir(req.user);

	// 인증이 안된 경우
	if (!req.user) {
		console.log('사용자 인증이 안 된 상태임.');
		res.redirect('/');
		return;
	}

	// 인증된 경우
	console.log('사용자 인증된 상태임.');
	if (Array.isArray(req.user)) {
		res.render('profile.ejs', {user: req.user[0]._doc});
	}
	else {
		res.render('profile.ejs', {user: req.user});
	}
});

// 로그인 폼 링크
app.get('/login', function(req, res) {
	console.log('/login 패스 요청됨.');
	res.render('login.ejs', {message: req.flash('loginMessage')});
});

app.post('/login', passport.authenticate('local-login', {
	successRedirect: '/profile',
	failureRedirect: '/login',
	failureFlash: true
}));

// 회원가입 폼 링크
app.get('/signup', function(req, res) {
	console.log('/signup 패스 요청됨.');
	res.render('signup.ejs', {message: req.flash('signupMessage')});
});

app.post('/signup', passport.authenticate('local-signup', {
	successRedirect: '/profile',
	failureRedirect: '/signup',
	failureFlash: true
}));

// 로그아웃
app.get('/logout', function(req, res) {
	console.log('/logout 패스 요청됨.');
	req.logout();
	res.redirect('/');
});

// ===== 404 오류 페이지 처리 ===== //
var errorHandler = expressErrorHandler({
	static: {
		'404': './public/404.html'
	}
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

// ===== 서버 시작 ===== //
http.createServer(app).listen(app.get('port'), function() {
	console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));

	// 데이터베이스 연결
	database_loader.init(app, config);
});