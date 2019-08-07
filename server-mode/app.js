'use strict';
const http = require('http');
const url = require('url');
const net = require("net");
const alidns = require('./alidns.js');
const config = require('./config.json');

// hostname 以 query string 形式传入, 格式为 xxx.xxx.xxx.example.com
// 以上 example.com 为域名，xxx.xxx.xxx 为子域名
// ip 如果在 query string 中出现, 则设定为该 ip, 否则设定为访问客户端的 ip
const getTarget = req => {
  return {
    hostname: url.parse(req.url, true).query.hostname,
    ip: url.parse(req.url, true).query.ip
      || req.headers[config.clientIpHeader.toLowerCase()]
      || req.connection.remoteAddress
      || req.socket.remoteAddress
      || req.connection.socket.remoteAddress
  };
};

let watingQueue = [];

let httpServerStatus = 0;
setInterval(ActivateHttpServer, 500);

let curtSocket = null;

// 服务器端监听
let httpServer = http.createServer((req, res) => {
  req.on('error', err => {
    console.error(err);
    res.statusCode = 400;
    res.end();
  });
  res.on('error', err => {
    console.error(err);
  });
  res.on("finish", function () {
    curtSocket = null;
    setTimeout(dealRequest, 300);
  });
  if (req.method === 'GET' && url.parse(req.url, true).pathname === config.path) {
    const target = getTarget(req);
    if (target.ip.startsWith("::ffff:")) {
      target.ip = target.ip.substring("::ffff:".length);
    }
    alidns.updateRecord(target, (msg) => {
      if (msg === 'error') {
        res.statusCode = 400;
      }
      console.log(new Date() + ': [' + msg + '] ' + JSON.stringify(target));
      res.end(msg);
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});

net.createServer(function (socket) {
  enqueueSocket(socket);
}).listen(config.port);

function enqueueSocket(socket) {
  watingQueue.push(socket);
}

function dealRequest() {
  if (watingQueue.length <= 0 && curtSocket == null) {
    httpServerStatus = 0;
    return;
  }

  httpServerStatus = 1;

  curtSocket = watingQueue.shift();
  httpServer.emit("connection", curtSocket);
}

function ActivateHttpServer() {
  if (httpServerStatus == 0) {
    dealRequest();
  }
}