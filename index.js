const core = require("@actions/core");
const github = require("@actions/github");
const { promises: fs } = require("fs");
const glob = require("@actions/glob");
const { IGNORE_FILE } = require("./ignore-files");
const {
  SOURCE_TYPES,
  IMAGE_TYPES,
  AUDIO_TYPES,
  VIDEO_TYPES,
} = require("./include-files");
const FormData = require("form-data");
const https = require("https");
const wait = require("./wait");

// CONSTANTS
const personal_access_token_input = `${core.getInput("personal-access-token")}`;
const jspsych_version = `${core.getInput("jspsych-version")}`;

const API_KEY_URL = "https://www.cognition.run/account";
const UPGRADE_URL = "https://www.cognition.run/account";
const SUPPORT_FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSdYg3h6ESzd81rHlGlAib_kXA56ERuy0MBM1CwPeUdTv4lvcQ/viewform";

const ENDPOINT = "https://www.cognition.run/external/api/github/v1/resource";
let repository = github.context.payload.repository;
const REQUEST_URL = `${ENDPOINT}/${repository ? repository.name : ""}`;
const AUTHORIZATION = `Bearer ${personal_access_token_input}`;

async function httpPostFileError(filePath, errorMessage, httpResponse) {
  core.error(errorMessage);
  core.debug(
    `Error uploading ${filePath} to ${httpResponse.method}:${httpResponse.url} with status code ${httpResponse.statusCode}`
  );
  core.setFailed(`Unable to deploy ${filePath} to Cognition.`);
}

async function uploadFile(filePath) {
  core.debug(`Uploading ${filePath} to Cognition.`);

  const fileHandle = await fs.open(filePath);
  const fileStats = await fileHandle.stat();
  const fileReadStream = fileHandle.createReadStream();

  const formData = new FormData();
  const filename = filePath.replace(/^.*[\\/]/, "");

  if (jspsych_version != null) {
    formData.append("jspsych_version", jspsych_version);
  }

  formData.append("file", fileReadStream, {
    knownLength: fileStats.size,
    filename,
    filepath: filePath,
    contentType: "multipart/form-data",
  });

  const formDataHeaders = formData.getHeaders();
  const requestTotalHeaders = {
    Authorization: AUTHORIZATION,
    ...formDataHeaders,
  };

  const request = https.request(REQUEST_URL, {
    method: "POST",
    protocol: "https:",
    port: 443,
    headers: requestTotalHeaders,
  });

  formData.pipe(request);

  request.on("response", async function (response) {
    let data = "";
    response.on("data", (chunk) => {
      data += chunk;
    });

    const statusCode = response.statusCode;
    response.on("end", () => {
      if (data.length > 0) {
        core.debug(`Body: ${data}`);
        if (statusCode === 200) {
          const parsedBody = JSON.parse(data);
          core.setOutput("link", parsedBody.public_link);
        }
      }
    });

    if (statusCode === 401 || statusCode === 403) {
      await httpPostFileError(
        filePath,
        `Unable to deploy ${filePath} to Cognition. The action script could connect to Cognition server, but the 
        API key has expired or is not recognized by the system. Check your Cognition account API key at ${API_KEY_URL} . 
        If the problem persist, please contact us at ${SUPPORT_FORM} .`,
        response
      );
    } else if (statusCode === 402) {
      await httpPostFileError(
        filePath,
        `Unable to deploy ${filePath} to Cognition. Your credentials are correct, but your account has reached 
    the limit of stored tasks or your current plan do not support the current experiment. Upgrade your plan at: ${UPGRADE_URL}`,
        response
      );
    } else if (statusCode === 404 || statusCode === 422) {
      await httpPostFileError(
        filePath,
        `Unable to deploy ${filePath} to Cognition. The action could connect to the server, but the deploy 
    was rejected. This issue can be related to a deprecated action version. Please upgrade your workflow file to require
    the last version of this action. If the problem persist, please contact us at ${SUPPORT_FORM} .`,
        response
      );
    } else if (statusCode !== 200) {
      await httpPostFileError(
        filePath,
        `Unable to deploy ${filePath} to Cognition. The script could connect to Cognition server, but it 
        found an unexpected error. Please try again later. If the problem persist  , please contact us at ${SUPPORT_FORM} .`,
        response
      );
    } else {
      core.info(`${filePath} successfully uploaded to Cognition.`);
    }
  });
}

function isExperimentFile(file) {
  return !file.includes("node_modules") && !file.startsWith(".");
}

// most @actions toolkit packages have async methods
async function run() {
  try {
    // Look for index.js or index.html
    const globber = await glob.create(
      SOURCE_TYPES.concat(IMAGE_TYPES)
        .concat(AUDIO_TYPES)
        .concat(VIDEO_TYPES)
        .join("\n"),
      {
        followSymbolicLinks: false,
      }
    );
    const files = globber.globGenerator();
    const firsFile = await files.next();
    await uploadFile(firsFile);
    await wait(1000); //Make sure one task is created
    for await (const file of files) {
      const filename = file.replace(/^.*[\\/]/, "");
      if (isExperimentFile(file) && !IGNORE_FILE.includes(filename)) {
        await uploadFile(file);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
