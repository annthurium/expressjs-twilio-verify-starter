const express = require("express");
const path = require("path");
const serveStatic = require("serve-static");
const bodyParser = require("body-parser");
const LaunchDarkly = require("@launchdarkly/node-server-sdk");
require("dotenv").config();

const app = express();

app.use(serveStatic(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Initialize the LaunchDarkly client
const ldClient = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY);

app.post("/login", (req, res) => {
  // Insert your authentication logic here
  console.log(req.body);
  let email = req.body.email;
  console.log(email);
  res.send(`email: ${email}`);
});

// Wait for the client to be ready before starting the server
ldClient.waitForInitialization().then(() => {
  const port = 3000;
  const server = app.listen(port, function (err) {
    if (err) console.log("Error in server setup");
    console.log(`Server listening on http://localhost:${port}`);

    // Evaluate a feature flag
    // ldClient.variation("your-feature-flag-key", { key: "user-key" }, false, (err, flagValue) => {
    //   if (err) {
    //     console.log("Error evaluating feature flag:", err);
    //   } else {
    //     console.log("Feature flag value:", flagValue);
    //   }
    // });
  });
});
