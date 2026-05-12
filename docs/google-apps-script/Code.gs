const RESPONSE_MIME_TYPE = ContentService.MimeType.JSON;
const SHEET_NAME = "Responses";
const HEADER_ROW = [
  "Recorded At",
  "Typed Name",
  "Selected Action",
  "Condition",
  "Pressed At ISO Timestamp",
  "Time From Page Open To Selection Milliseconds"
];

function doPost(event) {
  try {
    const requestData = getRequestData(event);
    const validationError = getValidationError(requestData);

    if (validationError) {
      return createJsonResponse({
        ok: false,
        error: validationError
      });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(spreadsheet);
    ensureHeaderRow(sheet);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      sheet.appendRow([
        new Date(),
        requestData.typedName,
        requestData.selectedAction,
        requestData.condition,
        requestData.pressedAtIsoTimestamp,
        requestData.timeFromPageOpenToSelectionMilliseconds
      ]);
    } finally {
      lock.releaseLock();
    }

    return createJsonResponse({
      ok: true
    });
  } catch (error) {
    return createJsonResponse({
      ok: false,
      error: String(error)
    });
  }
}

function doGet() {
  return createJsonResponse({
    ok: true,
    message: "Tracking endpoint is running. Send POST requests from the website."
  });
}

function getRequestData(event) {
  const parameterData = event && event.parameter ? event.parameter : {};
  const jsonData = getJsonData(event);

  return {
    typedName: getStringValue(jsonData.typedName || parameterData.typedName),
    selectedAction: getStringValue(jsonData.selectedAction || parameterData.selectedAction),
    condition: getStringValue(jsonData.condition || parameterData.condition),
    pressedAtIsoTimestamp: getStringValue(jsonData.pressedAtIsoTimestamp || parameterData.pressedAtIsoTimestamp),
    timeFromPageOpenToSelectionMilliseconds: getStringValue(
      jsonData.timeFromPageOpenToSelectionMilliseconds ||
        parameterData.timeFromPageOpenToSelectionMilliseconds
    )
  };
}

function getJsonData(event) {
  if (!event || !event.postData || !event.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    return {};
  }
}

function getStringValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function getValidationError(requestData) {
  if (requestData.typedName.length === 0) {
    return "Missing typedName.";
  }

  if (requestData.selectedAction !== "Accept" && requestData.selectedAction !== "Reject") {
    return "selectedAction must be Accept or Reject.";
  }

  if (requestData.condition.length === 0) {
    return "Missing condition.";
  }

  if (requestData.pressedAtIsoTimestamp.length === 0) {
    return "Missing pressedAtIsoTimestamp.";
  }

  return "";
}

function getOrCreateSheet(spreadsheet) {
  const existingSheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (existingSheet) {
    return existingSheet;
  }

  return spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaderRow(sheet) {
  const firstRowValues = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  const headerAlreadyExists = firstRowValues.some(function (cellValue) {
    return String(cellValue).length > 0;
  });

  if (headerAlreadyExists) {
    return;
  }

  sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
}

function createJsonResponse(responseData) {
  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(RESPONSE_MIME_TYPE);
}
