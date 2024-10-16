const express = require("express");
const path = require("path");
const serveStatic = require("serve-static");
const bodyParser = require("body-parser");
const LaunchDarkly = require("@launchdarkly/node-server-sdk");
require("dotenv").config();

const twilio = require("twilio");
const app = express();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const verifyServiceSid = process.env.VERIFY_SERVICE_SID;

async function createSMSVerification(phoneNumber) {
  const verification = await twilioClient.verify.v2
    .services(verifyServiceSid)
    .verifications.create({
      channel: "sms",
      to: phoneNumber,
    });

  console.log("Twilio verification created:", verification.sid);
}

app.use(serveStatic(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const ldClient = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY);

app.post("/verify", async (req, res) => {
  const phoneNumber = req.body["phone"];
  await createSMSVerification(phoneNumber);
  // Redirect to the verification form page with the phone number as a query parameter
  // TODO: test this
  // const phoneNumber = encodeURIComponent(req.body.phone);
  res.redirect(`/verification-form.html?phone=${phoneNumber}`);
});

async function checkVerificationCode(phoneNumber, verificationCode) {
  // Format the phone number to E.164 format
  // TODO: there has got to be a better way to do this :-/
  const formattedPhoneNumber = phoneNumber.replace(/\D/g, "");
  const e164PhoneNumber = formattedPhoneNumber.startsWith("1")
    ? `+${formattedPhoneNumber}`
    : `+1${formattedPhoneNumber}`;
  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: e164PhoneNumber,
        code: verificationCode,
      });

    console.log(`Verification status: ${verificationCheck.status}`);
    return verificationCheck.status === "approved";
  } catch (error) {
    console.error("Error checking verification code:", error);
    return false;
  }
}

app.post("/submit-verification-code", async (req, res) => {
  const verificationCode = req.body["verification-code"];
  const phoneNumber = req.body["phone"];
  console.log("QS Param phone number", phoneNumber);

  if (!phoneNumber || !verificationCode) {
    return res
      .status(400)
      .send("Phone number and verification code are required.");
  }

  const isVerified = await checkVerificationCode(phoneNumber, verificationCode);

  if (isVerified) {
    res.redirect("/success.html");
  } else {
    res.status(400).send("Invalid verification code. Please try again.");
  }
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
