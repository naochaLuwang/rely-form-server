const express = require("express");
const cors = require("cors");
let cron = require("node-cron");
const mongoose = require("mongoose");
require("dotenv").config();
const Form = require("./models/Form");
const Patient = require("./models/Patient");
const FormFeedback = require("./models/Forms");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
// middleware
app.use(cors());
app.use(express.json());

let feedbackData = [];

mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log("Connection successful");
  })
  .catch((err) => {
    console.log(err);
  });

cron.schedule("5 * * * *", () => {
  console.log("running a task every five minute");
  smsScheduler();
});

const smsScheduler = async () => {
  try {
    const response = await Form.findOne({ formType: "IPD", status: true });

    console.log(response);

    const data = await fetch(
      "http://doctorapi.relyhealthportal.com/api/Patient/GetIPDPatients?tenantID=1&statusID=2"
    );

    const user = await data.json();

    // console.log(user);

    for (let i = 0; i < user.responseResult.length; i++) {
      const feedback = await FormFeedback.findOne({
        submittedBy: user.responseResult[i].regID,
        formId: response.formId,
      });

      // const duplicateData = (regID) => {
      //   return feedbackData.regID === regID;
      // };

      // const checkDuplicate = feedbackData.filter(
      //   duplicateData(user.responseResult[i].regID)
      // );

      // console.log(checkDuplicate);

      if (!feedback) {
        feedbackData.push({
          formId: response.formId,
          formName: response.formName,
          formUrl: `https://rely-form.herokuapp.com/form/${
            response.formId
          }?regId=${Buffer.from(
            `${user.responseResult[i].regID}`,
            "binary"
          ).toString("base64")}`,

          averageWeightage: response.averageWeightage,
          maximumWeightage: response.maximumWeightage,
          minimumWeightage: response.minimumWeightage,
          createdBy: response.createdBy,
          isSubmitted: false,
          submittedBy: user.responseResult[i].regID,
          overallScore: 0,
          patient: {
            salutationName: user.responseResult[i].salutationName,
            name: user.responseResult[i].patientName,
            regId: user.responseResult[i].regID,
            patientType: user.responseResult[i].patientType,
            ageY: user.responseResult[i].ageY,
            gender: user.responseResult[i].genderName,
            primaryMobileNumber: user.responseResult[i].primaryMobileNo,
            iPDNumber: user.responseResult[i].iPDNumber,
            uhid: user.responseResult[i].hRNO,
          },
          form: response.form,
        });
      }
    }

    if (feedbackData) {
      FormFeedback.insertMany(feedbackData)
        .then(function () {
          console.log("Data inserted");
          feedbackData = []; // Success
        })
        .catch(function (error) {
          console.log(error); // Failure
        });
    }
  } catch (error) {
    console.log(error);
  }
};

smsScheduler();

app.get("/", (req, res) => {
  res.json({ message: "Hello" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
