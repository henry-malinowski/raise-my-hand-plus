import assert from "node:assert/strict";
import test from "node:test";

class Field {
  constructor(options = {}) {
    Object.assign(this, options);
    if (!this.choices && this.constructor._defaults?.choices) {
      this.choices = this.constructor._defaults.choices;
    }
  }

  static get _defaults() {
    return {};
  }
}

class SchemaField extends Field {
  constructor(fields, options = {}) {
    super(options);
    this.fields = fields;
  }
}

class SetField extends Field {
  constructor(element, options = {}) {
    super(options);
    this.element = element;
  }
}

class DataModel {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static get schema() {
    this._schema ??= {fields: this.defineSchema()};
    return this._schema;
  }

  static migrateData(source) {
    return source;
  }

  toObject() {
    return {...this};
  }
}

class ClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...classes) {
    for (const className of classes) this.classes.add(className);
    this.#sync();
  }

  remove(...classes) {
    for (const className of classes) this.classes.delete(className);
    this.#sync();
  }

  contains(className) {
    return this.classes.has(className);
  }

  toggle(className, force) {
    const shouldAdd = force ?? !this.classes.has(className);
    if (shouldAdd) this.classes.add(className);
    else this.classes.delete(className);
    this.#sync();
  }

  setFromString(value) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
    this.#sync();
  }

  #sync() {
    this.element._className = [...this.classes].join(" ");
  }
}

class FakeStyle {
  setProperty(name, value) {
    this[name] = value;
  }

  getPropertyValue(name) {
    return this[name] ?? "";
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.dataset = {};
    this.parentNode = null;
    this.eventListeners = new Map();
    this.style = new FakeStyle();
    this.textContent = "";
    this._className = "";
    this.classList = new ClassList(this);
    this.offsetWidth = 260;
    this.offsetHeight = 68;
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this.children = [];
    if (value.includes("<i")) {
      const icon = new FakeElement("i");
      const iconClass = value.match(/<i class="([^"]+)"/)?.[1] ?? "";
      icon.className = iconClass;
      this.appendChild(icon);
    }
    if (value.includes("raise-my-hand-speaker-banner")) {
      if (value.includes("raise-my-hand-speaker-frame")) {
        const frame = new FakeElement("div");
        frame.className = "raise-my-hand-speaker-frame";
        this.appendChild(frame);
      }

      const banner = new FakeElement("div");
      banner.className = "raise-my-hand-speaker-banner";
      if (value.includes("raise-my-hand-speaker-avatar")) {
        const avatar = new FakeElement("div");
        avatar.className = "raise-my-hand-speaker-avatar";
        banner.appendChild(avatar);
      }

      const text = new FakeElement("div");
      text.className = "raise-my-hand-speaker-text";
      text.textContent = value.match(/<div class="raise-my-hand-speaker-text">([^<]*)<\/div>/)?.[1] ?? "";
      banner.appendChild(text);
      this.appendChild(banner);
      return;
    }
    if (value.includes("raise-my-hand-speaker-text")) {
      const text = new FakeElement("div");
      text.className = "raise-my-hand-speaker-text";
      text.textContent = value.match(/<div class="raise-my-hand-speaker-text">([^<]*)<\/div>/)?.[1] ?? "";
      this.appendChild(text);
    }
    if (value.includes("queue-position")) {
      const position = new FakeElement("span");
      position.className = "queue-position";
      this.appendChild(position);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, callback) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(callback);
    this.eventListeners.set(type, listeners);
  }

  dispatchEvent(event) {
    for (const callback of this.eventListeners.get(event.type) ?? []) callback(event);
  }

  getBoundingClientRect() {
    return {
      left: Number.parseFloat(this.style.left) || 0,
      top: Number.parseFloat(this.style.top) || 0,
      width: this.offsetWidth,
      height: this.offsetHeight
    };
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    this.#walk(child => {
      if (matchesSelector(child, selector)) matches.push(child);
    });
    return matches;
  }

  #walk(callback) {
    for (const child of this.children) {
      callback(child);
      child.#walk(callback);
    }
  }
}

function matchesSelector(element, selector) {
  if (selector.startsWith(".camera-view[data-user=")) {
    const userId = selector.match(/data-user="([^"]+)"/)?.[1];
    return element.classList.contains("camera-view") && element.dataset.user === userId;
  }
  if (selector.startsWith(".")) return element.classList.contains(selector.slice(1));
  if (selector === "i") return element.tagName === "i";
  if (selector === ".queue-position") return element.classList.contains("queue-position");
  if (selector === ".raise-my-hand-queue-badge") return element.classList.contains("raise-my-hand-queue-badge");
  if (selector === ".raise-my-hand-speaker-banner") return element.classList.contains("raise-my-hand-speaker-banner");
  return false;
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body");
    this.cameraRoot = new FakeElement("div");
    this.cameraRoot.id = "camera-views";
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    if (selector === "#raise-my-hand-speaker-indication") {
      return this.body.children.find(child => child.id === "raise-my-hand-speaker-indication") ?? null;
    }
    if (selector === "#raise-my-hand-urgent-indication") {
      return this.body.children.find(child => child.id === "raise-my-hand-urgent-indication") ?? null;
    }
    if (selector.startsWith("#camera-views .camera-view[data-user=")) {
      const userId = selector.match(/data-user="([^"]+)"/)?.[1];
      const view = this.cameraRoot.children.find(child =>
        child.classList.contains("camera-view") && child.dataset.user === userId);
      if (!view) return null;
      if (selector.endsWith(".raise-my-hand-queue-badge")) {
        return view.querySelector(".raise-my-hand-queue-badge");
      }
      return view;
    }
    if (selector.startsWith(".camera-view[data-user=")) {
      const userId = selector.match(/data-user="([^"]+)"/)?.[1];
      const view = this.querySelectorAll(".camera-view").find(child => child.dataset.user === userId);
      if (!view) return null;
      if (selector.endsWith(".raise-my-hand-queue-badge")) {
        return view.querySelector(".raise-my-hand-queue-badge");
      }
      return view;
    }
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    if (selector === "#camera-views .camera-view") return [...this.cameraRoot.children];
    if (selector === ".camera-view") return [
      ...this.cameraRoot.querySelectorAll(selector),
      ...this.body.querySelectorAll(selector)
    ];
    if (selector === ".raise-my-hand-queue-badge") return this.cameraRoot.querySelectorAll(selector);
    if (selector === "#raise-my-hand-speaker-indication") return this.querySelector(selector) ? [this.querySelector(selector)] : [];
    if (selector === "#raise-my-hand-urgent-indication") return this.querySelector(selector) ? [this.querySelector(selector)] : [];
    return [];
  }

  addCameraView(userId, {outsideDock = false} = {}) {
    const cameraView = new FakeElement("div");
    cameraView.className = "camera-view";
    cameraView.dataset.user = userId;
    if (outsideDock) this.body.appendChild(cameraView);
    else this.cameraRoot.appendChild(cameraView);
    return cameraView;
  }
}

globalThis.foundry = {
  abstract: {DataModel},
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: Base => Base
    },
    handlebars: {
      renderTemplate: async () => ""
    },
    ui: {
      SceneControls: {
        buildToolclipItems: items => items
      }
    },
    ux: {
      FormDataExtended: class {}
    }
  },
  data: {
    fields: {
      BooleanField: Field,
      NumberField: Field,
      FilePathField: Field,
      SchemaField,
      StringField: Field,
      SetField
    }
  },
  helpers: {
    interaction: {
      KeyboardManager: {
        MODIFIER_CODES: {},
        getKeycodeDisplayString: key => key
      }
    },
    Localization: {
      localizeDataModel: () => {}
    }
  },
  utils: {
    expandObject: object => object,
    isNewerVersion: () => false
  }
};

globalThis.Hooks = {
  callAll: () => {},
  once: () => {},
  on: () => {}
};
globalThis.Handlebars = {registerHelper: () => {}};
const renderCalls = [];
globalThis.ui = {
  controls: {controls: {tokens: {tools: {}}}, render: options => renderCalls.push(options ?? {})},
  notifications: {info: () => {}}
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  eventListeners: new Map(),
  addEventListener(type, callback) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(callback);
    this.eventListeners.set(type, listeners);
  },
  removeEventListener(type, callback) {
    const listeners = this.eventListeners.get(type) ?? [];
    this.eventListeners.set(type, listeners.filter(listener => listener !== callback));
  },
  dispatchEvent(event) {
    for (const callback of this.eventListeners.get(event.type) ?? []) callback(event);
  }
};
const settingsState = {
  enableQueue: false,
  speakerIndication: true,
  speakerIndicationPosition: null,
  xCardSettings: {isEnabled: false, scope: "all-players", anonymousWarning: false},
  handSettings: {
    general: {
      isToggle: true,
      notificationModes: new Set(["camera"])
    },
    playerList: {scope: "all-players"},
    camera: {scope: "all-players"}
  }
};
const settingWrites = [];

globalThis.game = {
  i18n: {
    localize: key => key,
    format: (key, data) => {
      if (key === "raise-my-hand.SPEAKER_INDICATION") return `${data.name} speaks`;
      if (key === "raise-my-hand.SPEAKER_INDICATION_SELF") return "You are speaking";
      if (key === "raise-my-hand.RP_SCENE_START_REQUEST") return "Someone wants to start RP scene";
      if (key === "raise-my-hand.RP_SCENE_START_REQUEST_SELF") return "You want to start RP scene";
      if (key === "raise-my-hand.RP_SCENE_STARTED") return "RP scene started";
      if (key === "raise-my-hand.URGENT_SPEAKER_WAITING") return "Urgent speaker waiting";
      return key;
    }
  },
  keybindings: {register: () => {}, get: () => []},
  modules: {get: () => ({api: null})},
  settings: {
    register: () => {},
    registerMenu: () => {},
    get: (_moduleId, key) => {
      if (key === "enableQueue") return settingsState.enableQueue;
      if (key === "speakerIndication") return settingsState.speakerIndication;
      if (key === "speakerIndicationPosition") return settingsState.speakerIndicationPosition;
      if (key === "handSettings") return settingsState.handSettings;
      if (key === "xCardSettings") return settingsState.xCardSettings;
      return undefined;
    },
    set: async (_moduleId, key, value) => {
      settingWrites.push({key, value});
      settingsState[key] = value;
      return value;
    }
  },
  userId: "u1",
  user: {id: "u1", isGM: false},
  users: {
    activeGM: {id: "gm"},
    get: id => ({id, name: "User", avatar: ""}),
    filter: () => []
  }
};
globalThis.socketlib = {registerModule: () => ({register: () => {}})};
globalThis.ChatMessage = {
  getWhisperRecipients: () => [],
  create: () => {}
};
globalThis.AudioHelper = {};

const handlers = await import("../scripts/socket/handlers.mjs");
const socketState = await import("../scripts/socket/socket.mjs");
const controlsModule = await import("../scripts/controls.mjs");
const handHandlers = await import("../scripts/handlers/hand.mjs");
const {default: HandSettingsData} = await import("../scripts/data/settings/HandSettingsData.mjs");

test.beforeEach(() => {
  settingsState.enableQueue = false;
  settingsState.speakerIndication = true;
  settingsState.speakerIndicationPosition = null;
  settingsState.xCardSettings = {isEnabled: false, scope: "all-players", anonymousWarning: false};
  settingsState.handSettings = {
    general: {
      isToggle: true,
      notificationModes: new Set(["camera"])
    },
    playerList: {scope: "all-players"},
    camera: {scope: "all-players"}
  };
  settingWrites.length = 0;
  renderCalls.length = 0;
  window.eventListeners.clear();
  ui.controls.controls.tokens.tools = {};
});

test("hand settings exposes camera as a notification mode with scope", () => {
  const fields = HandSettingsData.schema.fields;

  assert.equal(
    fields.general.fields.notificationModes.element.choices.camera,
    "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.camera"
  );
  assert.ok(fields.camera.fields.scope);
});

test("camera notification mode shows a hand badge while queue is inactive", () => {
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1");

  assert.equal(typeof handlers.appendCameraIndicator, "function");

  handlers.appendCameraIndicator("u1");

  const badge = cameraView.querySelector(".raise-my-hand-queue-badge");
  assert.ok(badge);
  assert.ok(badge.classList.contains("raise-my-hand-camera-indicator"));
  assert.ok(badge.querySelector("i").classList.contains("fa-hand-paper"));
  assert.equal(badge.querySelector(".queue-position").textContent, "");
});

test("camera notification mode reapplies hand badge after camera view rerenders", () => {
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1");

  handlers.appendCameraIndicator("u1");
  cameraView.querySelector(".raise-my-hand-queue-badge").remove();

  handlers.updateCameraQueueBadges();

  assert.ok(cameraView.querySelector(".raise-my-hand-queue-badge"));
});

test("spotlight speaker is green even when not first participant", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList", "camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("u1");
  const secondCameraView = document.addCameraView("u2");

  handlers.syncQueueState(["u1", "u2"], [], "u2");

  const badge = secondCameraView.querySelector(".raise-my-hand-queue-badge");
  assert.ok(badge.classList.contains("speaking"));
  assert.ok(badge.querySelector("i").classList.contains("fa-bullhorn"));
  assert.equal(badge.querySelector(".queue-position").textContent, "");
});

test("spotlight request blocks snatch while another player speaks", () => {
  assert.equal(typeof handlers.requestSpotlightToggle, "function");
  assert.equal(typeof socketState.getGmSpeakerUserId, "function");
  assert.equal(typeof socketState.setGmSpeakerUserId, "function");

  game.userId = "gm";
  game.user.id = "gm";
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(true);

  handlers.requestQueueJoin("u1");
  handlers.requestQueueJoin("u2");

  handlers.requestSpotlightToggle("u1");
  assert.equal(socketState.getGmSpeakerUserId(), "u1");

  handlers.requestSpotlightToggle("u2");
  assert.equal(socketState.getGmSpeakerUserId(), "u1");

  handlers.requestSpotlightToggle("u1");
  assert.equal(socketState.getGmSpeakerUserId(), null);
  assert.deepEqual(socketState.getGmQueue().getAll(), ["u1", "u2"]);

  game.userId = "u1";
  game.user.id = "u1";
});

test("urgent participant becomes yellow after releasing spotlight", () => {
  assert.equal(typeof handlers.requestSpotlightToggle, "function");

  game.userId = "gm";
  game.user.id = "gm";
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(true);

  handlers.requestQueueJoin("u1");
  handlers.requestUrgent("u1");
  assert.ok(socketState.getGmUrgentUsers().has("u1"));

  handlers.requestSpotlightToggle("u1");
  assert.equal(socketState.getGmSpeakerUserId(), "u1");
  assert.equal(socketState.getGmUrgentUsers().has("u1"), false);

  handlers.requestSpotlightToggle("u1");
  assert.equal(socketState.getGmSpeakerUserId(), null);
  assert.equal(socketState.getGmUrgentUsers().has("u1"), false);
  assert.deepEqual(socketState.getGmQueue().getAll(), ["u1"]);

  game.userId = "u1";
  game.user.id = "u1";
});

test("urgent hands block yellow spotlight until all urgent users have spoken", () => {
  game.userId = "gm";
  game.user.id = "gm";
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(true);

  handlers.requestQueueJoin("yellow");
  handlers.requestQueueJoin("red1");
  handlers.requestQueueJoin("red2");
  handlers.requestUrgent("red1");
  handlers.requestUrgent("red2");

  handlers.requestSpotlightToggle("yellow");
  assert.equal(socketState.getGmSpeakerUserId(), null);

  handlers.requestSpotlightToggle("red2");
  assert.equal(socketState.getGmSpeakerUserId(), "red2");
  assert.equal(socketState.getGmUrgentUsers().has("red2"), false);
  assert.equal(socketState.getGmUrgentUsers().has("red1"), true);

  handlers.requestSpotlightToggle("red2");
  assert.equal(socketState.getGmSpeakerUserId(), null);

  handlers.requestSpotlightToggle("yellow");
  assert.equal(socketState.getGmSpeakerUserId(), null);

  handlers.requestSpotlightToggle("red1");
  assert.equal(socketState.getGmSpeakerUserId(), "red1");
  assert.equal(socketState.getGmUrgentUsers().size, 0);

  handlers.requestSpotlightToggle("red1");
  handlers.requestSpotlightToggle("yellow");
  assert.equal(socketState.getGmSpeakerUserId(), "yellow");

  game.userId = "u1";
  game.user.id = "u1";
});

test("urgent waiting indication is red and clears when no urgent hands remain", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["u1", "u2"], ["u2"], null, true);

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.querySelector(".raise-my-hand-speaker-text").textContent, "Urgent speaker waiting");
  assert.equal(overlay.style.getPropertyValue("--raise-my-hand-speaker-color"), "var(--raise-my-hand-red)");

  handlers.syncQueueState(["u1", "u2"], [], null, true);

  assert.equal(document.querySelector("#raise-my-hand-speaker-indication"), null);
});

test("urgent waiting indication stays visible while someone is speaking", () => {
  settingsState.enableQueue = true;
  settingsState.speakerIndicationPosition = {x: 40, y: 88};
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("speaker");
  document.addCameraView("urgent");
  game.userId = "viewer";
  game.user.id = "viewer";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["speaker", "urgent"], ["urgent"], "speaker", true);

  const speakerOverlay = document.querySelector("#raise-my-hand-speaker-indication");
  const urgentOverlay = document.querySelector("#raise-my-hand-urgent-indication");
  assert.ok(speakerOverlay);
  assert.ok(urgentOverlay);
  assert.equal(speakerOverlay.querySelector(".raise-my-hand-speaker-text").textContent, "speaker speaks");
  assert.equal(urgentOverlay.querySelector(".raise-my-hand-speaker-text").textContent, "Urgent speaker waiting");
  assert.equal(urgentOverlay.style.getPropertyValue("--raise-my-hand-speaker-color"), "var(--raise-my-hand-red)");
  const urgentBanner = urgentOverlay.querySelector(".raise-my-hand-speaker-banner");
  assert.equal(urgentBanner.style.left, "312px");
  assert.equal(urgentBanner.style.top, "88px");
  assert.ok(urgentBanner.classList.contains("is-positioned"));
});

test("scene indications use status-specific colors", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "viewer";
  game.user.id = "viewer";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["speaker"], [], "speaker", true);
  let overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.style.getPropertyValue("--raise-my-hand-speaker-color"), "var(--raise-my-hand-green)");

  handlers.clearPlayerListIcons();
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  handlers.showSceneStartRequestIndication("u1");
  overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.style.getPropertyValue("--raise-my-hand-speaker-color"), "var(--raise-my-hand-yellow)");

  handlers.clearPlayerListIcons();
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "Player One", avatar: ""});
  handlers.syncQueueState([], [], null, false);
  handlers.syncQueueState(["u1"], [], null, true);
  overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.style.getPropertyValue("--raise-my-hand-speaker-color"), "var(--raise-my-hand-blue)");
});

test("non-speaking scene indications do not show avatars", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "viewer";
  game.user.id = "viewer";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: `icons/${id}.webp`});

  handlers.syncQueueState(["urgent"], ["urgent"], null, true);

  const urgentOverlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(urgentOverlay);
  assert.equal(urgentOverlay.querySelector(".raise-my-hand-speaker-text").textContent, "Urgent speaker waiting");
  assert.equal(urgentOverlay.querySelector(".raise-my-hand-speaker-avatar"), null);

  handlers.clearPlayerListIcons();
  const sceneDocument = new FakeDocument();
  globalThis.document = sceneDocument;

  handlers.syncQueueState(["starter"], [], null, true);

  const sceneOverlay = sceneDocument.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(sceneOverlay);
  assert.equal(sceneOverlay.querySelector(".raise-my-hand-speaker-text").textContent, "RP scene started");
  assert.equal(sceneOverlay.querySelector(".raise-my-hand-speaker-avatar"), null);
});

test("speaking scene indication keeps avatar", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "speaker";
  game.user.id = "speaker";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: `icons/${id}.webp`});

  handlers.syncQueueState(["speaker"], [], "speaker", true);

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.querySelector(".raise-my-hand-speaker-text").textContent, "You are speaking");
  assert.notEqual(overlay.querySelector(".raise-my-hand-speaker-avatar"), null);
});

test("scene indication does not render screen border frame", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "speaker";
  game.user.id = "speaker";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["speaker"], [], "speaker", true);

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.querySelector(".raise-my-hand-speaker-frame"), null);
});

test("speaker and urgent indications align before dragging", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("speaker");
  document.addCameraView("urgent");
  game.userId = "viewer";
  game.user.id = "viewer";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["speaker", "urgent"], ["urgent"], "speaker", true);

  const speakerBanner = document
    .querySelector("#raise-my-hand-speaker-indication")
    .querySelector(".raise-my-hand-speaker-banner");
  const urgentBanner = document
    .querySelector("#raise-my-hand-urgent-indication")
    .querySelector(".raise-my-hand-speaker-banner");

  assert.equal(speakerBanner.style.top, urgentBanner.style.top);
  assert.equal(speakerBanner.style.top, "28px");
  assert.equal(speakerBanner.style.left, "374px");
  assert.equal(urgentBanner.style.left, "646px");
  assert.ok(speakerBanner.classList.contains("is-positioned"));
  assert.ok(urgentBanner.classList.contains("is-positioned"));
});

test("speaker indication says you are speaking for the local speaker", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("u1");
  game.userId = "u1";
  game.user.id = "u1";

  handlers.syncQueueState(["u1"], [], "u1");

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.querySelector(".raise-my-hand-speaker-text").textContent, "You are speaking");
});

test("speaker indication uses assigned actor name for remote speaker", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("u1");
  game.userId = "viewer";
  game.user.id = "viewer";
  game.users.get = id => ({id, name: "Guy", character: {name: "Sir Garrick"}, avatar: ""});

  handlers.syncQueueState(["u1"], [], "u1", true);

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(overlay.querySelector(".raise-my-hand-speaker-text").textContent, "Sir Garrick speaks");
});

test("speaker indication uses saved client position", () => {
  settingsState.enableQueue = true;
  settingsState.speakerIndicationPosition = {x: 144, y: 88};
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("u1");

  handlers.syncQueueState(["u1"], [], "u1");

  const banner = document
    .querySelector("#raise-my-hand-speaker-indication")
    .querySelector(".raise-my-hand-speaker-banner");
  assert.equal(banner.style.left, "144px");
  assert.equal(banner.style.top, "88px");
  assert.ok(banner.classList.contains("is-positioned"));
});

test("dragging speaker indication saves client position", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("u1");

  handlers.syncQueueState(["u1"], [], "u1");

  const banner = document
    .querySelector("#raise-my-hand-speaker-indication")
    .querySelector(".raise-my-hand-speaker-banner");
  banner.dispatchEvent({
    type: "pointerdown",
    button: 0,
    clientX: 20,
    clientY: 24,
    preventDefault: () => {}
  });
  window.dispatchEvent({type: "pointermove", clientX: 200, clientY: 160});
  window.dispatchEvent({type: "pointerup", clientX: 200, clientY: 160});

  assert.deepEqual(settingWrites.at(-1), {
    key: "speakerIndicationPosition",
    value: {x: 180, y: 136}
  });
});

test("dragging urgent indication moves glued speaker pair", () => {
  settingsState.enableQueue = true;
  settingsState.speakerIndicationPosition = {x: 40, y: 88};
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  document.addCameraView("speaker");
  document.addCameraView("urgent");
  game.userId = "viewer";
  game.user.id = "viewer";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id, avatar: ""});

  handlers.syncQueueState(["speaker", "urgent"], ["urgent"], "speaker", true);

  const speakerBanner = document
    .querySelector("#raise-my-hand-speaker-indication")
    .querySelector(".raise-my-hand-speaker-banner");
  const urgentBanner = document
    .querySelector("#raise-my-hand-urgent-indication")
    .querySelector(".raise-my-hand-speaker-banner");

  urgentBanner.dispatchEvent({
    type: "pointerdown",
    button: 0,
    clientX: 320,
    clientY: 100,
    preventDefault: () => {},
    stopPropagation: () => {}
  });
  window.dispatchEvent({type: "pointermove", clientX: 400, clientY: 150});
  window.dispatchEvent({type: "pointerup", clientX: 400, clientY: 150, stopPropagation: () => {}});

  assert.equal(speakerBanner.style.left, "120px");
  assert.equal(speakerBanner.style.top, "138px");
  assert.equal(urgentBanner.style.left, "392px");
  assert.equal(urgentBanner.style.top, "138px");
  assert.deepEqual(settingWrites.at(-1), {
    key: "speakerIndicationPosition",
    value: {x: 120, y: 138}
  });
});

test("gm rp scene controls replace hand controls in scene spotlight mode", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList"]);
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;

  const controls = {tokens: {tools: {}}};
  controlsModule.registerTokenControls(controls);
  ui.controls.controls = controls;

  assert.equal(controls.tokens.tools["raise-hand"].visible, false);
  assert.equal(controls.tokens.tools["show-xcard"].visible, false);
  assert.ok(controls.tokens.tools["rp-scene"]);
  assert.equal(controls.tokens.tools["rp-scene"].visible, true);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
});

test("gm rp scene end clears participants urgent speakers and active scene", () => {
  assert.equal(typeof handlers.requestSceneStart, "function");
  assert.equal(typeof handlers.requestSceneEnd, "function");
  assert.equal(typeof socketState.isGmSceneActive, "function");

  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(false);

  handlers.requestSceneStart();
  assert.equal(socketState.isGmSceneActive(), true);

  handlers.requestQueueJoin("u1");
  handlers.requestUrgent("u1");
  socketState.setGmSpeakerUserId("u1");

  handlers.requestSceneEnd();

  assert.equal(socketState.isGmSceneActive(), false);
  assert.deepEqual(socketState.getGmQueue().getAll(), []);
  assert.equal(socketState.getGmUrgentUsers().size, 0);
  assert.equal(socketState.getGmSpeakerUserId(), null);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
});

test("players see hand controls but no rp scene button while inactive", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList"]);
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.activeGM.id = "gm";
  socketState.setGmSceneActive(false);
  handlers.syncQueueState([], [], null, false);

  const controls = {tokens: {tools: {}}};
  controlsModule.registerTokenControls(controls);
  ui.controls.controls = controls;

  assert.equal(controls.tokens.tools["raise-hand"].visible, true);
  assert.equal(controls.tokens.tools["show-xcard"].visible, true);
  assert.equal(controls.tokens.tools["rp-scene"], undefined);
});

test("player hand raise before scene requests gm start without starting scene", async () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList", "camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1");
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.setGmSceneActive(false);
  handlers.syncQueueState([], [], null, false);

  const controls = {tokens: {tools: {}}};
  controlsModule.registerTokenControls(controls);
  ui.controls.controls = controls;
  const localUser = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
  const fakeSocket = {
    register: () => {},
    executeForAllGMs: (handler, ...args) => {
      const previous = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
      game.userId = "gm";
      game.user.id = "gm";
      game.user.isGM = true;
      handler(...args);
      game.userId = previous.userId;
      game.user.id = previous.id;
      game.user.isGM = previous.isGM;
    },
    executeForEveryone: (handler, ...args) => {
      const previous = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
      game.userId = localUser.userId;
      game.user.id = localUser.id;
      game.user.isGM = localUser.isGM;
      handler(...args);
      game.userId = previous.userId;
      game.user.id = previous.id;
      game.user.isGM = previous.isGM;
    },
    executeAsUser: () => {}
  };
  socketlib.registerModule = () => fakeSocket;
  socketState.initSocket();

  await handHandlers.raise({skipTimeout: true});

  assert.equal(socketState.isGmSceneActive(), false);
  assert.equal(handlers.isSceneActive(), false);
  assert.deepEqual(socketState.getGmQueue().getAll(), ["u1"]);
  assert.deepEqual(handlers.getLocalQueue().getAll(), ["u1"]);
  assert.ok(cameraView.querySelector(".raise-my-hand-queue-badge"));
  assert.equal(
    document.querySelector("#raise-my-hand-speaker-indication")
      .querySelector(".raise-my-hand-speaker-text").textContent,
    "You want to start RP scene"
  );

  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("lowering pending hand removes pre-scene camera badge", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["camera"]);
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1");
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.setGmSceneActive(false);

  handlers.requestQueueJoin("u1");
  assert.ok(cameraView.querySelector(".raise-my-hand-queue-badge"));

  handlers.requestQueueRemove("u1");

  assert.equal(cameraView.querySelector(".raise-my-hand-queue-badge"), null);
  assert.deepEqual(handlers.getLocalQueue().getAll(), []);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("gm sees indication when a player requests an rp scene", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList"]);
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.setGmSceneActive(false);

  handlers.showSceneStartRequestIndication("u1");

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(
    overlay.querySelector(".raise-my-hand-speaker-text").textContent,
    "Someone wants to start RP scene"
  );

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("gm scene start clears pending start request indication", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList"]);
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});

  handlers.syncQueueState([], [], null, false);
  handlers.showSceneStartRequestIndication("u1");
  assert.equal(
    document.querySelector("#raise-my-hand-speaker-indication")
      .querySelector(".raise-my-hand-speaker-text").textContent,
    "Someone wants to start RP scene"
  );

  handlers.syncQueueState(["u1"], [], null, true);

  assert.equal(document.querySelector("#raise-my-hand-speaker-indication"), null);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("last pending player lowering hand removes start request indication", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set(["playerList"]);
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.setGmSceneActive(false);

  handlers.requestQueueJoin("u1");
  assert.ok(document.querySelector("#raise-my-hand-speaker-indication"));

  handlers.requestQueueRemove("u1");

  assert.equal(document.querySelector("#raise-my-hand-speaker-indication"), null);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("gm start turns pending requesters into yellow participants without speaker", () => {
  settingsState.enableQueue = true;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(false);

  handlers.requestQueueJoin("u1");
  handlers.requestSceneStart();

  assert.equal(socketState.isGmSceneActive(), true);
  assert.deepEqual(socketState.getGmQueue().getAll(), ["u1"]);
  assert.equal(socketState.getGmSpeakerUserId(), null);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: "User", avatar: ""});
});

test("gm space starts scene only after a player requested it", () => {
  settingsState.enableQueue = true;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(false);
  handlers.syncQueueState([], [], null, false);

  assert.equal(handHandlers.snatchSpotlight(), false);
  assert.equal(socketState.isGmSceneActive(), false);

  handlers.requestQueueJoin("u1");
  assert.equal(handHandlers.snatchSpotlight(), true);

  assert.equal(socketState.isGmSceneActive(), true);
  assert.deepEqual(socketState.getGmQueue().getAll(), ["u1"]);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
});

test("gm space ends active rp scene", () => {
  settingsState.enableQueue = true;
  game.userId = "gm";
  game.user.id = "gm";
  game.user.isGM = true;
  game.users.activeGM.id = "gm";
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(false);

  handlers.requestQueueJoin("u1");
  handlers.requestSceneStart();
  assert.equal(socketState.isGmSceneActive(), true);

  assert.equal(handHandlers.snatchSpotlight(), true);

  assert.equal(socketState.isGmSceneActive(), false);
  assert.deepEqual(socketState.getGmQueue().getAll(), []);

  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
});

test("players see indication when gm starts an rp scene", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  handlers.syncQueueState([], [], null, false);

  handlers.syncQueueState(["u1"], [], null, true);

  const overlay = document.querySelector("#raise-my-hand-speaker-indication");
  assert.ok(overlay);
  assert.equal(
    overlay.querySelector(".raise-my-hand-speaker-text").textContent,
    "RP scene started"
  );
});

test("player hand raise during active scene shows yellow camera badge", async () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set([]);
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1");
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.activeGM.id = "gm";
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  socketState.getGmQueue().clear();
  socketState.getGmUrgentUsers().clear();
  socketState.setGmSpeakerUserId(null);
  socketState.setGmSceneActive(true);
  handlers.syncQueueState([], [], null, true);

  const localUser = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
  const fakeSocket = {
    register: () => {},
    executeForAllGMs: (handler, ...args) => {
      const previous = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
      game.userId = "gm";
      game.user.id = "gm";
      game.user.isGM = true;
      handler(...args);
      game.userId = previous.userId;
      game.user.id = previous.id;
      game.user.isGM = previous.isGM;
    },
    executeForEveryone: (handler, ...args) => {
      const previous = {userId: game.userId, id: game.user.id, isGM: game.user.isGM};
      game.userId = localUser.userId;
      game.user.id = localUser.id;
      game.user.isGM = localUser.isGM;
      handler(...args);
      game.userId = previous.userId;
      game.user.id = previous.id;
      game.user.isGM = previous.isGM;
    },
    executeAsUser: () => {}
  };
  socketlib.registerModule = () => fakeSocket;
  socketState.initSocket();

  await handHandlers.raise({skipTimeout: true});

  const badge = cameraView.querySelector(".raise-my-hand-queue-badge");
  assert.ok(badge);
  assert.ok(badge.querySelector("i").classList.contains("fa-hand-paper"));
  assert.equal(badge.classList.contains("speaking"), false);
  assert.equal(badge.classList.contains("urgent"), false);
});

test("scene camera badge renders on camera views outside dock scope", () => {
  settingsState.enableQueue = true;
  settingsState.handSettings.general.notificationModes = new Set([]);
  const document = new FakeDocument();
  globalThis.document = document;
  const cameraView = document.addCameraView("u1", {outsideDock: true});
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});

  handlers.syncQueueState(["u1"], [], null, true);

  const badge = cameraView.querySelector(".raise-my-hand-queue-badge");
  assert.ok(badge);
  assert.ok(badge.querySelector("i").classList.contains("fa-hand-paper"));
});

test("moving non-speaker indication survives position refresh", () => {
  settingsState.enableQueue = true;
  const document = new FakeDocument();
  globalThis.document = document;
  game.userId = "u1";
  game.user.id = "u1";
  game.user.isGM = false;
  game.users.get = id => ({id, name: id === "u1" ? "Player One" : "GM", avatar: ""});
  handlers.syncQueueState([], [], null, false);
  handlers.syncQueueState(["u1"], [], null, true);

  const banner = document
    .querySelector("#raise-my-hand-speaker-indication")
    .querySelector(".raise-my-hand-speaker-banner");
  banner.dispatchEvent({
    type: "pointerdown",
    button: 0,
    clientX: 20,
    clientY: 24,
    preventDefault: () => {}
  });
  window.dispatchEvent({type: "pointerup", clientX: 20, clientY: 24});

  handlers.updateCameraQueueBadges();

  assert.equal(
    document.querySelector("#raise-my-hand-speaker-indication")
      .querySelector(".raise-my-hand-speaker-text").textContent,
    "RP scene started"
  );
});

test("clearing an active rp scene requests a controls reset", () => {
  handlers.syncQueueState([], [], null, true);
  renderCalls.length = 0;

  handlers.clearPlayerListIcons();

  assert.ok(renderCalls.some(call => call.reset === true));
});
