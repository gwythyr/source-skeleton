const express = require('express');
const path = require('path');

function handleRequest(req, res) {
  const filePath = path.join(__dirname, 'index.html');
  res.sendFile(filePath);
}

const middleware = (req, res, next) => {
  console.log(req.method, req.url);
  next();
};

async function startServer(port) {
  const app = express();
  app.use(middleware);
  app.get('/', handleRequest);
  app.listen(port);
}

const double = (x) => x * 2;
