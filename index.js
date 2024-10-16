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

async function formatPhoneNumber(phoneNumber) {
  try {
    const lookup = await twilioClient.lookups.v2
      .phoneNumbers(phoneNumber)
      .fetch();
    return lookup.phoneNumber;
  } catch (error) {
    console.error("Error formatting phone number:", error);
    return phoneNumber; // Return original number if lookup fails
  }
}

async function checkVerificationCode(phoneNumber, verificationCode) {
  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code: verificationCode,
      });

    console.log(`Verification status: ${verificationCheck.status}`);
    return verificationCheck.status === "approved";
  } catch (error) {
    console.error("Error checking verification code:", error);
    return false;
  }
}

app.post("/verify", async (req, res) => {
  // Use LaunchDarkly flag to control whether extra verification step is shown.
  const context = {
    kind: "user",
    anonymous: true,
    key: "anonymous-123", // Generate a unique key for each anonymous user
  };
  const extraVerification = await ldClient.variation(
    "extra-verification-new-users",
    context,
    false
  );
  console.log("extraVerification", extraVerification);

  if (extraVerification === false) {
    return res.redirect("/success.html");
  }

  const phoneNumber = req.body["phone"];
  // Use Twilio Lookup to format the phone number as E.164
  const e164PhoneNumber = await formatPhoneNumber(phoneNumber);
  await createSMSVerification(e164PhoneNumber);
  // Redirect to the verification form page with the phone number as a query parameter
  // so the user doesn't have to re-enter it
  const encodedPhoneNumber = encodeURIComponent(e164PhoneNumber);
  res.redirect(`/verification-form.html?phone=${encodedPhoneNumber}`);
});

app.post("/submit-verification-code", async (req, res) => {
  const verificationCode = req.body["verification-code"];
  const phoneNumber = req.body["phone"];

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
  });
});

// Add the following new function to gracefully close the connection to the LaunchDarkly server.
process.on("SIGTERM", () => {
  debug("SIGTERM signal received: closing HTTP server");
  ld.close();
  server.close(() => {
    debug("HTTP server closed");
    ldClient.close();
  });
});
