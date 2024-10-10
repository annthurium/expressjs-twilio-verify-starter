const express = require("express");
const path = require("path");
const serveStatic = require("serve-static");
const bodyParser = require("body-parser");

const app = express();

app.use(serveStatic(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/login", (req, res) => {
  // Insert your authentication logic here
  console.log(req.body);
  let email = req.body.email;
  console.log(email);
  res.send(`email: ${email}`);
});

const port = 3000;
const server = app.listen(port, function (err) {
  if (err) console.log("Error in server setup");
  console.log(`Server listening on http://localhost:${port}`);
});
