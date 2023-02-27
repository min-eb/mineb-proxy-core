console.log("min_eb proxy")
var https = require('https')
var http = require('http')
var fs = require('fs')
var express = require('express')
var ejs  = require('ejs')
var bent = require('bent')

var vhost = require('vhost')
var httpProxy = require('http-proxy')
var apiProxy = httpProxy.createProxyServer()
var bodyParser = require('body-parser')

//var reqhandle = require('/datadisk2/server/reqhandle.js')

var chalk = require('chalk')


var app = express()
var app_http = express()

//vhosts
var internalv = express()
var sessionv = express()
var sources = express()
var index = express()
var blog = express()
var word = express()
var archive = express()
var drive = express()
var thread = express()

//vhost의 내부 ip 입력

var session_n = 'https://localhost:3000'
    blog_n = 'https://localhost:3001',
    word_n = 'https://localhost:3002',
    archive_n = 'https://localhost:3003',
    drive_n = 'https://localhost:3101',
    thread_n = 'https://localhost:3200'


//https 인증서 적용

if (fs.existsSync("/etc/letsencrypt/live/index.mineb.net/fullchain.pem") && fs.existsSync("/etc/letsencrypt/live/index.mineb.net/fullchain.pem")) {
  require('https').globalAgent.options.ca = require('ssl-root-cas').create()

  var options = {
    key: fs.readFileSync("/etc/letsencrypt/live/index.mineb.net/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/index.mineb.net/fullchain.pem")
  }

  https.createServer(options, app).listen(443)
  http.createServer(app_http).listen(80)
  console.log("Proxy Server Ready")
  app.use(function(req, res, next) {
    reqhandle.locals(req, res, next)
  })

  //vhost 설정
  
  app.use(vhost("192.168.0.50", internalv))
  app.use(vhost("session.mineb.net", sessionv))
  app.use(vhost("sources.mineb.net", sources))
  app.use(vhost("index.mineb.net", index))
  app.use(vhost("blog.mineb.net", blog))
  app.use(vhost("word.mineb.net", word))
  app.use(vhost("thread.mineb.net", thread))
  app.use(vhost("archive.mineb.net", archive))
  app.use(vhost("drive.mineb.net", drive))


  app_http.use('/.well-known', express.static(__dirname + '/static/.well-known'))
  app_http.use('/legacy', express.static(__dirname + '/static/legacy'))
  app_http.all("*", (req, res) => {
    let to = "https://" +  req.headers.host + req.url;
    res.redirect(to)
})
} else {
  console.log("Err: HTTPS Certification Was Not Found!")
  http.createServer(app).listen(80)  //80포트로 http 서비스
  console.log("Listening @ Port 80")
  app.use('/.well-known', express.static(__dirname + '/static/.well-known'))
}




var redis = require("redis")
var session = require('express-session')
const { setTimeout } = require('timers')
const { stdin } = require('process')
var redisStore = require("connect-redis")(session)
var redisClient = redis.createClient({
    legacyMode: true
})
redisClient.on('connect', () => {
  console.info('Redis connected!');
})
redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
})
redisClient.connect().then()
const redisCli = redisClient.v4
app.use(session({
  secret: fs.readFileSync('/datadisk2/conf/mongod_key.conf'),
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1209600000, domain:'mineb.net' },
  store: new redisStore({
    client: redisClient
  })
}))

index.set("view engine", "ejs")
internalv.set("view engine", "ejs")


sources.use(express.static(__dirname + '/static'))



//internalv
internalv.get("/", function(req, res) {
  res.render('indexv', {process_name: process_name, process_stdout: process_stdout})
  console.log(process_name.length)
})

internalv.get("/halt/:id", function(req, res) {
  process_env[req.params.id].kill()
  res.redirect("/")
})

internalv.get("/halt", function(req, res) {
  process.exit(1)
})

//blog page
blog.use("/", function(req, res) {
  apiProxy.web(req, res, {target: blog_n}, function(err){
    if(err){
      reqhandle.err_521(req, res)
    }
  })
})

//word page
word.use("/", function(req, res) {
    apiProxy.web(req, res, {target: word_n}, function(err){
      if(err){
        reqhandle.err_521(req, res)
        console.log(err)
      }
    })
})

//session page
sessionv.use("/", function(req, res) {
  apiProxy.web(req, res, {target: session_n}, function(err){
    if(err){
      reqhandle.err_521(req, res)
    }
  })
})

//thread page
thread.use("/", function(req, res) {
  apiProxy.web(req, res, {target: thread_n}, function(err){
    if(err){
      reqhandle.err_521(req, res)
    }
  })
})

//archive page
archive.use("/", function(req, res) {
  apiProxy.web(req, res, {target: archive_n}, function(err){
    if(err){
      reqhandle.err_521(req, res)
    }
  })
})

//index page (직접 관리)

index.get("/", function(req, res) {
  res.render('index.ejs')
})

index.use(function(req, res, next) {
  reqhandle.err_404(req, res)
})

app.use(function(req, res, next) {
  reqhandle.err_404(req, res)
})


//자식 프로세스 생성

var spawn = require("child_process").spawn
var process_env = []
var process_stdout = []
var process_name = []

function makechild(name) {
  console.log(chalk.blue.bold("Child process was created:"), name)
  if (!process_name[name]) {process_name.push(name)}
  process_stdout[name] = []
    process_name[name] = []
    process_env[name] = []
  process_stdout[name] = []
  process_env[name] = spawn("nodemon", ["--exitcrash", "app.js"],
    {cwd:"/datadisk2/server/"+name+"/"}
  )

  process_env[name].stdout.on('data', function(data){
    if (process_stdout[name].length > 10) { process_stdout[name] = process_stdout[name].splice(0, 1) }
    process_stdout[name].push(data.toString())
    //console.log(data.toString())
  })

  process_env[name].stderr.on('data', function(data){
    if (process_stdout[name].length > 10) { process_stdout[name] = process_stdout[name].splice(0, 1) }
    process_stdout[name].push(data.toString())
    //console.log(data.toString())
  })

  process_env[name].on('close', function (code) {
    console.log(chalk.red.bold("\nError at child process:"), name, code)
    console.log(process_stdout[name].join([separator = '']))
    console.log("Restarting ...\n")
    setTimeout(() => {
      makechild(name)
    }, 5000);
  })
}

function makechildExt(cmd) {
  console.log(chalk.blue.bold("Child process was created(Ext):"), cmd)
  process_stdout[cmd] = []
  process_env[cmd] = spawn("bash",
    {cwd:"/datadisk2/db/"}
  )

  process_env[cmd].stdin.write(cmd+"\n")

  process_env[cmd].stdout.on('data', function(data){
    if (process_stdout[cmd].length > 10) { process_stdout[cmd] = process_stdout[cmd].splice(0, 1) }
    process_stdout[cmd].push(data.toString())
    //console.log(data.toString())
  })

  process_env[cmd].stderr.on('data', function(data){
    if (process_stdout[cmd].length > 10) { process_stdout[cmd] = process_stdout[cmd].splice(0, 1) }
    process_stdout[cmd].push(data.toString())
    //console.log(data.toString())
  })

  process_env[cmd].on('close', function (code) {
    process_env[cmd].kill()
    console.log(chalk.red.bold("\nError at child process:"), cmd, code)
    console.log(process_stdout[cmd].join([separator = '']))
    process_stdout[cmd] = []
    process_name[cmd] = []
    process_env[cmd] = []
    process_env.splice(cmd, 0)
    console.log("Restarting ...\n")
    setTimeout(() => {
      makechildExt(cmd)
    }, 1500);
  })
}


makechildExt("mongod --config /datadisk2/db/mongodb/mongod.conf")
setTimeout(() => {
  makechild('word')
  makechild('session')
  makechild('blog')
  makechild('archive')
}, 2000)

//gracefully shutdown

process.once('SIGUSR2', async function () {
  console.log("Bye ...")
  for (i in process_env) {
    await process_env[i].kill()
  }
  process.kill(process.pid, 'SIGUSR2');
})