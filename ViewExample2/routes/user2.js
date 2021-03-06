// 사용자 로그인
var login = function(req, res) {
	console.log('user 모듈 안에 있는 login 호출됨.');

	var paramId = req.param('id');
	var paramPassword = req.param('password');

	var database = req.app.get('database');

	if (database) {
		authUser(database, paramId, paramPassword, function(err, docs) {
			if (err) {throw err;}

			if (docs) {
				console.dir(docs);

				// 조회 결과에서 사용자 이름 확인
				var username = docs[0].name;
				
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});

				// 뷰 템플릿을 사용하여 렌더링 후 전숭
				var context = {userid:paramId, username:username};
				req.app.render('login_success', context, function(err, html) {
					if (err) {throw err;}
					console.log('rendered: ' + html);

					res.end(html);
				});
			}
		});
	}
	else {
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.write('<div><p>데이터베이스에 연결하지 못했습니다.</p></div>');
		res.end();
	}
}

// 사용자 추가
var adduser = function(req, res) {
	console.log('user 모듈 안에 있는 adduser 호출됨.');

	var paramId = req.body.id || req.query.id;
	var paramPassword = req.body.password || req.query.password;
	var paramName = req.body.name || req.query.name;

	console.log('요청 파라미터: ' + paramId + ', ' + paramPassword + ', ' + paramName);

	var database = req.app.get('database');

	// 데이터베이스 객체가 초기화된 경우
	if (database) {
		addUser(database, paramId, paramPassword, paramName, function(err, result) {
			if (err) {throw err;}

			// 결과 객체 확인하여 응답 전송
			if (result) {
				console.dir(result);

				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});

				// 뷰 템플릿으로 렌더링 후 전송
				var context = {title: '사용자 추가 성공'};
				req.app.render('adduser', context, function(err, html) {
					if (err) {
						console.error('뷰 렌더링 중 오류 발생: ' + err.stack);

						res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
						res.write('<h2>뷰 렌더링 중 오류 발생</h2>');
						res.write('<p>' + err.stack + '</p>');
						res.end();

						return;
					}

					console.log('rendered: ' + html);

					res.end(html);
				});
			}
			else {
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 추가 실패</h2>');
				res.end();
			}
		});
	}
	else {
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
}

// 사용자 리스트 함수
var listuser = function(req, res) {
	console.log('user 모듈 안에 있는 listuser 호출됨.');

	var database = req.app.get('database');

	// 데이터베이스 객체가 초기화된 경우
	if (database) {
		// 모든 사용자 검색
		database.UserModel.findAll(function(err, results) {
			// 오류 발생시
			if (err) {
				console.error('사용자 리스트 조회 중 오류 발생 : ' + err.stack);

				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회 중 오류 발생</h2>');
				res.write('<p>' + err.stack + '</p>');
				res.end();

				return;
			}

			if (results) {
				console.dir(results);

				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});

				// 뷰 템플릿을 이용하여 렌더링 후 전송
				var context = {results: results};
				req.app.render('listuser', context, function(err, html) {
					if (err) {
						console.error('뷰 렌더링 중 오류 발생: ' + err.stack);

						res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
						res.write('<h2>뷰 렌더링 중 오류 발생</h2>');
						res.write('<p>' + err.stack + '</p>');
						res.end();

						return;
					}
					console.log('rendered: ' + html);
					
					res.end(html);
				});
			}
			else {
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회 실패</h2>');
				res.end();
			}
		});
	}
	else {
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
}

// 사용자 추가 함수
var addUser = function(database, id, password, name, callback) {
	console.log('addUser 호출됨.');

	// UserModel 인스턴스 생성
	var user = new database.UserModel({"id": id, "password": password, "name": name});

	// save()로 저장
	user.save(function(err) {
		if (err) {
			callback(err, null);
			return;
		}
		console.log("사용자 데이터 추가함.");
		callback(null, user);
	});
}

// 사용자 인증 함수
var authUser = function(db, id, password, callback) {
	console.log('authUser 호출됨.');

	// 1. 아이디를 사용하여 검색
	db.UserModel.findById(id, function(err, results) {
		if (err) {
			callback(err, null);
			return;
		}

		console.log('아이디[%s]로 사용자 검색 결과', id);
		console.dir(results);

		if (results.length > 0) {
			console.log('아이디와 일치하는 사용자 찾음.');

			var user = new db.UserModel({id: id});
			var authenticated = user.authenticate(password, results[0]._doc.salt,
				results[0]._doc.hashed_password);

			if (authenticated) {
				console.log('비밀번호 일치함');
				callback(null, results);
			}
			else {
				console.log('비밀번호 일치하지 않음');
				callback(null, null);
			}
		}
	});
}

module.exports.login = login;
module.exports.adduser = adduser;
module.exports.listuser = listuser;