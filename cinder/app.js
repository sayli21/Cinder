var express=require('express');
var bodyParser=require('body-parser');
var app=express();
var mongoose=require('mongoose');
var sessions=require('client-sessions');
var bcrypt=require('bcryptjs');
var client= require('twilio')('ACccd0a60d71cf2ad27153a54769c3237f','3e1901cb8e22bd675a178ae90c4a1b2b');
var csrf=require('csurf');


var Schema=mongoose.Schema;
var ObjectId=Schema.ObjectId;

//mongo connect
mongoose.connect('mongodb://localhost/cinderdb');

var User=mongoose.model('User', new Schema({
	id: ObjectId,
	name: {type:String, unique:true},
	email: {type:String, unique:true},
	mobile: Number,
	password: String,
	gender: String,
	food: String,
	movie: String,
	place: String,
	otp: Number,
}));

app.set('view engine','ejs');

app.locals.pretty=true;


app.use(express.static(__dirname + '/public'));

//middleware--runs request routes through here
app.use(bodyParser.urlencoded({extended:true}));
 
//session
app.use(sessions({
	cookieName: 'session',
	secret: 'sdafljhl435kjh534jl1kh435l3245kj435ljk345',
	duration: 30*60*1000,
	activeDuration: 5*60*1000,
	httpOnly: true,	//Browser javascript cannot access the cookies
	secure: true, 	//only use cookies over https
	ephemeral: true, 	//delete cookie when browser closed
}));


app.use(csrf());


app.use(function(req,res,next){
	if(req.session && req.session.user){
		User.findOne({name: req.session.user.name},function(err,user){
			if(user){
				req.user=user;
				delete req.user.password;
				req.session.user=req.user;
				res.locals.user=req.user;
			}
			next();
		});
	}
	else{
		next();
	}
});

function requireLogin(req,res,next){
	if(!req.user){
		res.redirect('/login',{error:''});
	}
	else{
		next();
	}
};


var port = process.env.PORT || 3000;
var io = require('socket.io').listen(app.listen(port));
console.log('listening on'+ port);


app.get('/',function(req,res){
	res.render('welcome.ejs');
});

app.get('/index',function(req,res){
	res.render('index.ejs');
});

var val;
var currentuser;

app.post('/register',function(req,res){
	var hash=bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));
	
	val = Math.floor(1000 + Math.random() * 9000);
	
	var user= new User({
		name: req.body.name,
		email: req.body.email,
		mobile: req.body.mobile,
		password: hash,
		gender: req.body.gender,
		food: req.body.food,
		movie: req.body.movie,
		place: req.body.place,
		otp: val,
	});
	user.save(function(err){
		if(err){
			var error='Something went wrong! Try again';
			if(err.code===11000){
				error='That nickname is already taken, please try another';
				console.log(error);
			}
			res.render('register.ejs',{error:error});
		}
		else{
			client.sendMessage({
				to: '+91'+req.body.mobile,
				from: '+12403770412',
				body: 'Dear '+req.body.name+', your otp for mobile verification is '+val
			}, function(err,data){
				if(err)
					console.log(err);
				console.log(data);
			});
			
			res.redirect('/test');
		}
	});
	

});

app.get('/register',function(req,res){
	res.render('register.ejs',{error:'',csrfToken:req.csrfToken()});
});

app.get('/test',function(req,res){
	res.render('test.ejs',{error:'',csrfToken:req.csrfToken()});
});

app.post('/test',function(req,res){
	if(req.body.otp==val){
		res.redirect('/login');
	}
	else{
		var err='The entered otp did not match!';
		console.log(err);
		res.render('test.ejs',{error:err,csrfToken:req.csrfToken()});
	}
});



app.get('/forgot',function(req,res){
	res.render('forgot.ejs',{error:''});
});

app.post('/forgot',function(req,res){
	res.render('login.ejs',{error:''});
});

app.get('/login',function(req,res){
	res.render('login.ejs',{error:'',csrfToken:req.csrfToken()});
});

app.post('/login',function(req,res){
	User.findOne({name: req.body.name},function(err,user){
		if(!user){
			res.render('login.ejs',{error:'Invalid nickname' });
		}
		else{
			if(bcrypt.compareSync(req.body.password, user.password)){
				req.session.user=user;  //set-cookie: session
				currentuser=req.body.name;
				res.redirect('/dashboard');
			}
			else{
				res.render('login.ejs',{error:'Invalid password' });
				
			}
		}
	});
});

app.get('/dashboard',requireLogin ,function(req,res){
	
		res.render('dashboard.ejs');
});
 
app.get('/logout',function(req,res){
	req.session.reset();
	res.redirect('/index');
});


var online={};


io.on('connection',function(socket){

	socket.emit('start',{name:currentuser});

	socket.on('newOnline',function(data){
		console.log(data.name+' is in the house');
		currentuser=data.name;
		socket.currentuser=currentuser;
		online[currentuser]=currentuser;
		socket.emit('welcome',{name:currentuser});
		console.log(online);
		socket.broadcast.emit('updateOnlineUsers',JSON.stringify(online));
		socket.emit('updateOnlineUsers',JSON.stringify(online));
	});


	socket.on('startChat',function(data){
		console.log(data);
	});

	socket.on('findMatch',function(data){
		var g,f,m,p;
		var count=0;
		var to;
		
		User.findOne({name: data.name},function(err,user){
			if(!user)
				console.log('Error');
			else{
				g=user.gender;
				f=user.food;
				m=user.movie;
				p=user.place;
		
			}
		});

		
		
		for(var i in online){

			if(i!=data.name){
				User.findOne({name: i},function(err,user){
				
					if(g!=user.gender){
						if(user.food==f && user.movie==m && user.place==p){
							if(count<3){
								count=3;
								to=user.name;
							}			
							
						}
						else if((user.food==f && user.movie==m) || (user.food==f && user.place==p) || (user.movie==m && user.place==p)){
							if(count<2){
								count=2;
								to=user.name;
							}
							
						}
						else if(user.food==f || user.movie==m || user.place==p){
							if(count<1){
								count=1;
								to=user.name;
							}
							
						}
						else{
							socket.emit('noMatch');
						}
					}
					else{
						socket.emit('noMatch');
					}
					
			});
	
		}
	}
	
	
	User.findOne({name: data.name},function(err,user){
			if(!user)
				console.log('Error');
			else{
				console.log(count);
				console.log(to);
				socket.emit('matched',{name:to});	
			}
		});
	
	
	});


	socket.on('startChat',function(data){
		socket.broadcast.emit('chatBox',{to:data.from});
		socket.emit('chatBox',{to:data.to});
		io.sockets.in(data.from).emit('chatBox',{to:data.to});
		io.sockets.in(data.to).emit('chatBox',{to:data.from});
	});


	socket.on('newMsg',function(data){
		socket.broadcast.emit('message',{from:data.from,msg:data.msg});
		
		io.sockets.in(data.from).emit('message',{from:data.from,msg:data.msg});
		io.sockets.in(data.to).emit('message',{from:data.from,msg:data.msg});
	});
	
	socket.on('disconnect',function(){
		delete online[socket.currentuser];
    	console.log(socket.currentuser+' disconnected');
    	console.log(online);
    	socket.broadcast.emit('updateOnlineUsers',JSON.stringify(online));
	});
});
