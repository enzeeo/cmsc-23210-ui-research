const TRACKING_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbz2BCyaOHCzEgYg69aBvDM7jusIlzZjAlGkTmMoY7WqmbGQ9ML1q0Ga0k9pre7QjikuvA/exec";
const SCROLL_TOLERANCE_IN_PIXELS = 2;
const SMALL_PLANET_LAYER_COUNT = 5;
const DUST_PLANET_LAYER_COUNT = 50;
const STAR_TAIL_COUNT = 201;
const TERMS_DOCUMENT_URL = "tc/visualTC.pdf";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TERMS_DOCUMENT_SCROLL_HEIGHT_OFFSET = 4;
const TERMS_DOCUMENT_RENDER_DELAY_IN_MILLISECONDS = 150;
const TRACKING_SESSION_STORAGE_KEY = "termsTrackingSessionState";
const MOBILE_PDF_ZOOM_BREAKPOINT_IN_PIXELS = 720;
const MOBILE_PDF_INITIAL_ZOOM_SCALE = 1.55;

let trackingSessionState = null;
let termsDocumentLoadingPromise = null;
let loadedTermsDocument = null;
let termsDocumentRenderedSuccessfully = false;
let latestTermsDocumentRenderIdentifier = 0;
let termsDocumentResizeTimeoutIdentifier = null;
let lastRenderedTermsDocumentWidth = 0;

function getElements() {
  return {
    cosmicBackground: document.getElementById("cosmicBackground"),
    termsContainer: document.getElementById("termsContainer"),
    termsDocumentViewer: document.getElementById("termsDocumentViewer"),
    termsDocumentStateMessage: document.getElementById("termsDocumentStateMessage"),
    nameInput: document.getElementById("nameInput"),
    acceptButton: document.getElementById("acceptButton"),
    rejectButton: document.getElementById("rejectButton"),
    statusMessage: document.getElementById("statusMessage")
  };
}

function hasScrolledToBottom(scrollableElement) {
  const visibleHeight = scrollableElement.clientHeight;
  const totalScrollHeight = scrollableElement.scrollHeight;
  const currentScrollTop = scrollableElement.scrollTop;
  const maxScrollPosition = totalScrollHeight - visibleHeight;
  const currentPosition = currentScrollTop + SCROLL_TOLERANCE_IN_PIXELS;

  return currentPosition >= maxScrollPosition;
}

function documentDoesNotNeedScrolling(scrollableElement) {
  const totalScrollHeight = scrollableElement.scrollHeight;
  const visibleHeight = scrollableElement.clientHeight;

  return totalScrollHeight <= visibleHeight + TERMS_DOCUMENT_SCROLL_HEIGHT_OFFSET;
}

function enableConsentControls(elements) {
  if (!elements.nameInput.disabled && !elements.acceptButton.disabled && !elements.rejectButton.disabled) {
    return;
  }

  elements.nameInput.disabled = false;
  elements.acceptButton.disabled = false;
  elements.rejectButton.disabled = false;
  elements.statusMessage.textContent = "";
}

function disableConsentControls(elements) {
  elements.nameInput.disabled = true;
  elements.acceptButton.disabled = true;
  elements.rejectButton.disabled = true;
}

function showMessage(elements, messageText) {
  elements.statusMessage.textContent = messageText;
}

function showTermsDocumentState(elements, messageText, stateType) {
  if (!elements.termsDocumentStateMessage) {
    return;
  }

  elements.termsDocumentStateMessage.hidden = false;
  elements.termsDocumentStateMessage.dataset.state = stateType;
  elements.termsDocumentStateMessage.textContent = messageText;
}

function hideTermsDocumentState(elements) {
  if (!elements.termsDocumentStateMessage) {
    return;
  }

  elements.termsDocumentStateMessage.hidden = true;
  elements.termsDocumentStateMessage.dataset.state = "";
  elements.termsDocumentStateMessage.textContent = "";
}

function clearTermsDocumentViewer(elements) {
  if (!elements.termsDocumentViewer) {
    return;
  }

  elements.termsDocumentViewer.replaceChildren();
}

function updateConsentAvailabilityForTermsContainer(elements) {
  if (!termsDocumentRenderedSuccessfully || !elements.termsContainer) {
    return;
  }

  if (
    documentDoesNotNeedScrolling(elements.termsContainer) ||
    hasScrolledToBottom(elements.termsContainer)
  ) {
    enableConsentControls(elements);
  }
}

function configurePdfJsLibrary() {
  if (!window.pdfjsLib) {
    throw new Error("PDF.js library is unavailable.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
}

function loadTermsDocument() {
  if (loadedTermsDocument) {
    return Promise.resolve(loadedTermsDocument);
  }

  if (termsDocumentLoadingPromise) {
    return termsDocumentLoadingPromise;
  }

  if (TERMS_DOCUMENT_URL.length === 0) {
    return Promise.reject(new Error("Terms document URL is missing."));
  }

  configurePdfJsLibrary();

  const loadingTask = window.pdfjsLib.getDocument(TERMS_DOCUMENT_URL);

  termsDocumentLoadingPromise = loadingTask.promise
    .then((pdfDocument) => {
      loadedTermsDocument = pdfDocument;
      return pdfDocument;
    })
    .catch((error) => {
      termsDocumentLoadingPromise = null;
      throw error;
    });

  return termsDocumentLoadingPromise;
}

function getTermsDocumentViewerWidth(elements) {
  if (!elements.termsDocumentViewer || !elements.termsContainer) {
    return 0;
  }

  const viewerWidth = elements.termsDocumentViewer.clientWidth;

  if (viewerWidth > 0) {
    return viewerWidth;
  }

  return elements.termsContainer.clientWidth;
}

function getSafeDevicePixelRatio() {
  if (typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0) {
    return window.devicePixelRatio;
  }

  return 1;
}

function getTermsDocumentRenderWidth(viewerWidth) {
  if (window.innerWidth <= MOBILE_PDF_ZOOM_BREAKPOINT_IN_PIXELS) {
    return viewerWidth * MOBILE_PDF_INITIAL_ZOOM_SCALE;
  }

  return viewerWidth;
}

function centerTermsDocumentHorizontalScrollOnMobile(elements) {
  if (!elements.termsContainer || window.innerWidth > MOBILE_PDF_ZOOM_BREAKPOINT_IN_PIXELS) {
    return;
  }

  const hiddenHorizontalWidth = elements.termsContainer.scrollWidth - elements.termsContainer.clientWidth;

  if (hiddenHorizontalWidth <= 0) {
    return;
  }

  elements.termsContainer.scrollLeft = hiddenHorizontalWidth / 2;
}

async function renderTermsDocumentPageToCanvas(pdfPage, viewerWidth) {
  const unscaledViewport = pdfPage.getViewport({ scale: 1 });
  const renderWidth = getTermsDocumentRenderWidth(viewerWidth);
  const pageScale = renderWidth / unscaledViewport.width;
  const scaledViewport = pdfPage.getViewport({ scale: pageScale });
  const devicePixelRatio = getSafeDevicePixelRatio();

  const pageCanvas = document.createElement("canvas");
  const canvasContext = pageCanvas.getContext("2d");

  if (!canvasContext) {
    throw new Error("Could not create a drawing context for the terms document.");
  }

  pageCanvas.className = "terms-document-canvas";
  pageCanvas.width = Math.ceil(scaledViewport.width * devicePixelRatio);
  pageCanvas.height = Math.ceil(scaledViewport.height * devicePixelRatio);
  pageCanvas.style.width = `${scaledViewport.width}px`;
  pageCanvas.style.height = `${scaledViewport.height}px`;

  canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  await pdfPage.render({
    canvasContext,
    viewport: scaledViewport
  }).promise;

  return pageCanvas;
}

async function renderTermsDocument(elements) {
  if (!elements.termsContainer || !elements.termsDocumentViewer) {
    return;
  }

  const currentRenderIdentifier = latestTermsDocumentRenderIdentifier + 1;
  latestTermsDocumentRenderIdentifier = currentRenderIdentifier;
  termsDocumentRenderedSuccessfully = false;

  disableConsentControls(elements);
  elements.termsContainer.scrollTop = 0;
  clearTermsDocumentViewer(elements);
  showTermsDocumentState(elements, "Loading terms document...", "loading");
  showMessage(elements, "");

  try {
    const pdfDocument = await loadTermsDocument();

    if (currentRenderIdentifier !== latestTermsDocumentRenderIdentifier) {
      return;
    }

    const viewerWidth = getTermsDocumentViewerWidth(elements);

    if (viewerWidth <= 0) {
      throw new Error("The terms document area is not ready for rendering yet.");
    }

    const pageElements = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pdfPage = await pdfDocument.getPage(pageNumber);

      if (currentRenderIdentifier !== latestTermsDocumentRenderIdentifier) {
        return;
      }

      const pageCanvas = await renderTermsDocumentPageToCanvas(pdfPage, viewerWidth);
      const pageWrapper = document.createElement("div");

      pageWrapper.className = "terms-document-page";
      pageWrapper.appendChild(pageCanvas);
      pageElements.push(pageWrapper);
    }

    if (currentRenderIdentifier !== latestTermsDocumentRenderIdentifier) {
      return;
    }

    elements.termsDocumentViewer.replaceChildren(...pageElements);
    centerTermsDocumentHorizontalScrollOnMobile(elements);
    hideTermsDocumentState(elements);
    termsDocumentRenderedSuccessfully = true;
    lastRenderedTermsDocumentWidth = viewerWidth;
    updateConsentAvailabilityForTermsContainer(elements);
  } catch (error) {
    if (currentRenderIdentifier !== latestTermsDocumentRenderIdentifier) {
      return;
    }

    clearTermsDocumentViewer(elements);
    termsDocumentRenderedSuccessfully = false;
    showTermsDocumentState(
      elements,
      "Could not load terms document. Please refresh page or try again later.",
      "error"
    );
    showMessage(elements, "Terms document must load before you can continue.");
  }
}

function scheduleTermsDocumentRerender(elements) {
  if (termsDocumentResizeTimeoutIdentifier !== null) {
    window.clearTimeout(termsDocumentResizeTimeoutIdentifier);
  }

  termsDocumentResizeTimeoutIdentifier = window.setTimeout(() => {
    termsDocumentResizeTimeoutIdentifier = null;
    void renderTermsDocument(elements);
  }, TERMS_DOCUMENT_RENDER_DELAY_IN_MILLISECONDS);
}

function initializeTermsDocumentViewer(elements) {
  if (!elements.termsContainer || !elements.termsDocumentViewer) {
    return;
  }

  elements.termsContainer.addEventListener("scroll", () => {
    updateConsentAvailabilityForTermsContainer(elements);
  });

  window.addEventListener("resize", () => {
    if (!loadedTermsDocument) {
      return;
    }

    const currentViewerWidth = getTermsDocumentViewerWidth(elements);

    if (Math.abs(currentViewerWidth - lastRenderedTermsDocumentWidth) <= 1) {
      return;
    }

    scheduleTermsDocumentRerender(elements);
  });

  void renderTermsDocument(elements);
}

function createBackgroundParticle() {
  const particleElement = document.createElement("div");

  particleElement.style.setProperty("--position-x", Math.random().toFixed(4));
  particleElement.style.setProperty("--position-y", Math.random().toFixed(4));
  particleElement.style.setProperty("--direction-x", (Math.random() - 0.5).toFixed(4));
  particleElement.style.setProperty("--direction-y", (Math.random() - 0.5).toFixed(4));
  particleElement.style.setProperty("--delay-factor", Math.random().toFixed(4));

  return particleElement;
}

function fillBackgroundLayer(layerElement, particleCount) {
  if (!layerElement) {
    return;
  }

  for (let i = 0; i < particleCount; i += 1) {
    layerElement.appendChild(createBackgroundParticle());
  }
}

function initializeCosmicBackground() {
  const elements = getElements();

  if (!elements.cosmicBackground) {
    return;
  }

  fillBackgroundLayer(
    elements.cosmicBackground.querySelector(".planets"),
    SMALL_PLANET_LAYER_COUNT
  );
  fillBackgroundLayer(
    elements.cosmicBackground.querySelector(".planets-2"),
    DUST_PLANET_LAYER_COUNT
  );
  fillBackgroundLayer(
    elements.cosmicBackground.querySelector(".startails"),
    STAR_TAIL_COUNT
  );
}

function readTrackingSessionStateFromStorage() {
  try {
    const storedTrackingSessionState = sessionStorage.getItem(TRACKING_SESSION_STORAGE_KEY);

    if (!storedTrackingSessionState) {
      return null;
    }

    return JSON.parse(storedTrackingSessionState);
  } catch (error) {
    return null;
  }
}

function writeTrackingSessionStateToStorage() {
  if (!trackingSessionState) {
    return;
  }

  try {
    sessionStorage.setItem(TRACKING_SESSION_STORAGE_KEY, JSON.stringify(trackingSessionState));
  } catch (error) {
    return;
  }
}

function clearTrackingSessionState() {
  trackingSessionState = null;

  try {
    sessionStorage.removeItem(TRACKING_SESSION_STORAGE_KEY);
  } catch (error) {
    return;
  }
}

function getCurrentTimestampInMilliseconds() {
  return Date.now();
}

function createNewTrackingSessionState() {
  const currentTimestampInMilliseconds = getCurrentTimestampInMilliseconds();

  return {
    openedAtMilliseconds: currentTimestampInMilliseconds,
    accumulatedActiveMilliseconds: 0,
    activeSegmentStartedAtMilliseconds: null
  };
}

function getSafeNumber(value, fallbackValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallbackValue;
}

function normalizeTrackingSessionState(candidateTrackingSessionState) {
  const defaultTrackingSessionState = createNewTrackingSessionState();

  if (!candidateTrackingSessionState || typeof candidateTrackingSessionState !== "object") {
    return defaultTrackingSessionState;
  }

  const normalizedOpenedAtMilliseconds = getSafeNumber(
    candidateTrackingSessionState.openedAtMilliseconds,
    defaultTrackingSessionState.openedAtMilliseconds
  );
  const normalizedAccumulatedActiveMilliseconds = getSafeNumber(
    candidateTrackingSessionState.accumulatedActiveMilliseconds,
    0
  );
  const rawActiveSegmentStartedAtMilliseconds =
    candidateTrackingSessionState.activeSegmentStartedAtMilliseconds;
  const normalizedActiveSegmentStartedAtMilliseconds =
    rawActiveSegmentStartedAtMilliseconds === null
      ? null
      : getSafeNumber(rawActiveSegmentStartedAtMilliseconds, null);

  return {
    openedAtMilliseconds: normalizedOpenedAtMilliseconds,
    accumulatedActiveMilliseconds: normalizedAccumulatedActiveMilliseconds,
    activeSegmentStartedAtMilliseconds: normalizedActiveSegmentStartedAtMilliseconds
  };
}

function isTermsPageActivelyVisible() {
  return document.visibilityState === "visible" && document.hasFocus();
}

function startActiveTrackingSegment() {
  if (!trackingSessionState || trackingSessionState.activeSegmentStartedAtMilliseconds !== null) {
    return;
  }

  trackingSessionState.activeSegmentStartedAtMilliseconds = getCurrentTimestampInMilliseconds();
  writeTrackingSessionStateToStorage();
}

function stopActiveTrackingSegment() {
  if (!trackingSessionState || trackingSessionState.activeSegmentStartedAtMilliseconds === null) {
    return;
  }

  const currentTimestampInMilliseconds = getCurrentTimestampInMilliseconds();
  const activeSegmentDurationInMilliseconds =
    currentTimestampInMilliseconds - trackingSessionState.activeSegmentStartedAtMilliseconds;

  trackingSessionState.accumulatedActiveMilliseconds += activeSegmentDurationInMilliseconds;
  trackingSessionState.activeSegmentStartedAtMilliseconds = null;
  writeTrackingSessionStateToStorage();
}

function updateTrackingForCurrentVisibilityState() {
  if (!trackingSessionState) {
    return;
  }

  if (isTermsPageActivelyVisible()) {
    startActiveTrackingSegment();
    return;
  }

  stopActiveTrackingSegment();
}

function getTrackedActiveMillisecondsAtSelection() {
  if (!trackingSessionState) {
    return 0;
  }

  if (trackingSessionState.activeSegmentStartedAtMilliseconds === null) {
    return trackingSessionState.accumulatedActiveMilliseconds;
  }

  const currentTimestampInMilliseconds = getCurrentTimestampInMilliseconds();

  return (
    trackingSessionState.accumulatedActiveMilliseconds +
    (currentTimestampInMilliseconds - trackingSessionState.activeSegmentStartedAtMilliseconds)
  );
}

function getSafeTrackedActiveMillisecondsAtSelection() {
  const trackedActiveMillisecondsAtSelection = getTrackedActiveMillisecondsAtSelection();

  if (!Number.isFinite(trackedActiveMillisecondsAtSelection) || trackedActiveMillisecondsAtSelection < 0) {
    return 0;
  }

  return Math.round(trackedActiveMillisecondsAtSelection);
}

function buildTrackingPayload(typedName, selectedAction) {
  const buttonPressedAtMilliseconds = Date.now();
  const trackedActiveMillisecondsAtSelection = getSafeTrackedActiveMillisecondsAtSelection();

  return {
    typedName,
    selectedAction,
    pressedAtIsoTimestamp: new Date(buttonPressedAtMilliseconds).toISOString(),
    timeFromPageOpenToSelectionMilliseconds: trackedActiveMillisecondsAtSelection
  };
}

function sendTrackingData(payload) {
  const formData = new URLSearchParams();

  formData.append("typedName", payload.typedName);
  formData.append("selectedAction", payload.selectedAction);
  formData.append("pressedAtIsoTimestamp", payload.pressedAtIsoTimestamp);
  formData.append(
    "timeFromPageOpenToSelectionMilliseconds",
    String(payload.timeFromPageOpenToSelectionMilliseconds)
  );

  return fetch(TRACKING_ENDPOINT_URL, {
    method: "POST",
    body: formData,
    keepalive: true
  });
}

async function handleButtonSelection(selectedAction, elements) {
  const typedName = elements.nameInput.value;

  if (typedName.length === 0) {
    showMessage(elements, "Please enter your name before continuing.");
    return;
  }

  stopActiveTrackingSegment();

  const trackingPayload = buildTrackingPayload(typedName, selectedAction);
  elements.acceptButton.disabled = true;
  elements.rejectButton.disabled = true;
  elements.nameInput.disabled = true;

  try {
    sendTrackingData(trackingPayload);
  } catch (error) {
    showMessage(elements, "Tracking endpoint is unavailable right now. Continuing to next page.");
  }

  clearTrackingSessionState();
  window.location.href = "link.html";
}

function initializeTrackingSessionState() {
  const storedTrackingSessionState = readTrackingSessionStateFromStorage();

  if (storedTrackingSessionState) {
    trackingSessionState = normalizeTrackingSessionState(storedTrackingSessionState);
    writeTrackingSessionStateToStorage();
  } else {
    trackingSessionState = createNewTrackingSessionState();
    writeTrackingSessionStateToStorage();
  }

  updateTrackingForCurrentVisibilityState();

  document.addEventListener("visibilitychange", updateTrackingForCurrentVisibilityState);
  window.addEventListener("focus", updateTrackingForCurrentVisibilityState);
  window.addEventListener("blur", updateTrackingForCurrentVisibilityState);
  window.addEventListener("pagehide", stopActiveTrackingSegment);
  window.addEventListener("beforeunload", stopActiveTrackingSegment);
}

function closeOtherNavigationDropdowns(activeNavigationDropdown, allNavigationDropdowns) {
  for (const navigationDropdown of allNavigationDropdowns) {
    if (navigationDropdown === activeNavigationDropdown) {
      continue;
    }

    navigationDropdown.open = false;
  }
}

function initializeDesktopNavigationDropdowns() {
  const allNavigationDropdowns = Array.from(document.querySelectorAll(".desktop-navigation .navigation-dropdown"));

  if (allNavigationDropdowns.length === 0) {
    return;
  }

  for (const navigationDropdown of allNavigationDropdowns) {
    navigationDropdown.addEventListener("toggle", () => {
      if (!navigationDropdown.open) {
        return;
      }

      closeOtherNavigationDropdowns(navigationDropdown, allNavigationDropdowns);
    });
  }
}

function initializeTermsPage() {
  const elements = getElements();

  if (!elements.termsContainer) {
    return;
  }

  initializeTrackingSessionState();
  initializeTermsDocumentViewer(elements);

  elements.acceptButton.addEventListener("click", async () => {
    await handleButtonSelection("Accept", elements);
  });

  elements.rejectButton.addEventListener("click", async () => {
    await handleButtonSelection("Reject", elements);
  });
}

initializeCosmicBackground();
initializeDesktopNavigationDropdowns();
initializeTermsPage();
