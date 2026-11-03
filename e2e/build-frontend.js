// Builds the frontend pointed at the e2e API into e2e/.build (leaves my-react-app/build untouched).
const { execSync } = require("child_process");
const path = require("path");

execSync("npx react-scripts build", {
    cwd: path.join(__dirname, "..", "my-react-app"),
    stdio: "inherit",
    env: {
        ...process.env,
        REACT_APP_API_URL: "http://localhost:4100",
        BUILD_PATH: path.join(__dirname, ".build"),
        CI: "true",
        GENERATE_SOURCEMAP: "false"
    }
});
