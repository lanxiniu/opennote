import Vue from "vue"
import Vuex from "vuex"
import VuexPersistence from "vuex-persist";
import { OutputData } from "@editorjs/editorjs";
import _ from "@/util";
import { ONoteSDK, UserModel, NoteModel } from "@/api.sdk";
import { ONoteSocket } from "@/socket";

export type LocalStore = typeof Store;
export type LocalState = LocalStore["state"];

const vuexLocal: any = new VuexPersistence<LocalState>({
  storage: window.localStorage,
  reducer: (state) => {
    const duplicate = Object.assign({}, state);
    delete duplicate.dory;
    return duplicate;
  }
});

Vue.use(Vuex)

const NEW_NOTE_NAME = "Untitled Note";

export interface Note {
  id: string;
  name: string;
  data: Object;
  created: number;
  updated: number;
  shortCode?: string;
}

const query = _.clearQueryString();
const IS_SECURE = location.href.split("://")[0].endsWith("s");

export const Store = new Vuex.Store({
  state: {
    currentNote: _.uuidv4(),
    notes: {

    } as { [id: string]: Note },
    preferences: {
      showLabels: true,
      showToolbox: true,
      hideEditorByDefaultOnMobile: true,
      sawFirstRun: false,
      preferredColorScheme: null as null | "light" | "dark",
      defaultNoteName: NEW_NOTE_NAME,
      defaultTrigState: "rad" as _.MathKit.TrigState,
      backend: null as null | string,
      enableCollaborationMode: false,
      useNewEditor: false
    },
    token: null as string | null,
    /**
     * cleared on reload
     */
    dory: {
      flashLoggedIn: parseInt(query.get("loggedIn")!) === 1,
      sdk: null as any as ONoteSDK,
      userModel: null as UserModel | null,
      loginMethods: [] as string[],
      socket: new ONoteSocket(),
      reRenderCount: 0
    }
  },
  mutations: {
    /**
     * Selects a new note
     */
    setNote(state, id) {
      state.currentNote = id;
    },
    /**
     * Creates a blank note and selects it
     */
    newNote(state, { id, data, name, created } = {}) {
      name = name || state.preferences.defaultNoteName;
      
      const noteName = new RegExp(name);
      const quantifier = new RegExp(/(?:\s\((\d+)\))?/);

      const merged = new RegExp("^" + noteName.source + quantifier.source + "$");

      const clashingNotes: RegExpMatchArray[] = Object.values(state.notes as {[key: string]: Note}).map(note => note.name.match(merged)).filter(n => !!n) as RegExpMatchArray[];

      if (clashingNotes.length > 0) {
        const [ previousMax ] = clashingNotes.map(([,idx]) => parseInt(idx || "0")).sort((a,b) => b - a);
        const nextNumber = previousMax + 1;

        name = `${name} (${nextNumber})`;
      }

      // state.notes[id] = ;
      Vue.set(state.notes, id, {
        id,
        data,
        name,
        created: created || Date.now()
      });
    },
    delNote(state, id) {
      const ids = Object.keys(state.notes);
      Vue.delete(state.notes, id);
    },
    /**
     * Updates a note, or inserts it if it was not present already
     */
    updateNote(state, { id, name, shortCode, data }) {
      const note = (state.notes[id] || (state.notes[id] = {} as any));
      Vue.set(note, "shortCode", shortCode || note.shortCode);
      Vue.set(note, "name", name || note.name || NEW_NOTE_NAME);
      Vue.set(note, "data", data || note.data || {});
    },
    setPreference(state, { name, value }) {
      (state.preferences as any)[name] = value;
    },
    overwritePreferences(state, preferences) {
      Vue.set(state, "preferences", preferences);
    },
    resetSDK(state) {
      if (!state.preferences.backend) return;
      state.dory.sdk = new ONoteSDK(state.preferences.backend);
      console.log(state.dory);
    },
    setUserModel(state, user: UserModel | null) {
      state.dory.userModel = user;
    },
    setLoginMethods(state, methods: string[]) {
      Vue.set(state.dory, "loginMethods", methods);
    },
    setToken(state, token: string) {
      Vue.set(state, "token", token);
    },
    setNotes(state, notes) {
      Vue.set(state, "notes", notes);
    },
    insertNote(state, note: NoteModel) {
      Vue.set(state.notes, note.id, note);
    },
    crud() {
      
    }
  },
  actions: {
    async newNote(state, { data, name, created } = {}) {
      var id;
      if (state.getters.authSDK) {
        const sdk: ONoteSDK = state.getters.authSDK;
        const note = await sdk.createNote({}, state.state.preferences.defaultNoteName);
        id = note.id;
        state.commit("insertNote", note);
      } else {
        id = _.uuidv4();
        while (state.state.notes[id]) id = _.uuidv4();
        state.commit("newNote", { id, data, name, created });
      }

      state.commit("setNote", id);
      return id;
    },
    async delNote(state, id: string) {
      if (state.getters.authSDK) {
        const sdk: ONoteSDK = state.getters.authSDK;
        await sdk.deleteNote(id);
      }
      state.commit("delNote", id);
    },
    async selectNote(state, id: string) {
      if (state.getters.sdk) {
        const sdk: ONoteSDK = state.getters.sdk;
        const note = await sdk.getNote(id);
        if (!note) return;
        state.commit("insertNote", note);
      }

      state.commit("setNote", id);
    },
    async updateNote(state, { id, name, shortCode, data }) {
      state.commit("updateNote", {
        data,
        id,
        name,
        shortCode
      });
  
      if (state.getters.sdk) {
        await state.getters.sdk.editNote(id, { data, name, shortCode });
      }
    },
    async refreshUserModel(state) {
      const { sdk } = state.state.dory;
      if (!sdk) return;
      const user = await sdk.fetchUserModel();
      state.commit("setUserModel", user);
    },
    async refreshLoginMethods(state) {
      const { sdk } = state.state.dory;
      if (!sdk) return;
      const methods = await sdk.fetchAcceptableLoginMethods();
      Store.commit("setLoginMethods", methods);
    },
    async refreshNotesFromServer(state) {
      const { sdk } = state.state.dory;
      if (!sdk) return;
      const notes = await sdk.cloudNotes();
      Store.commit("setNotes", notes.reduce((acc, note) => ({...acc, [note.id]: {
        name: note.name,
        data: note.data,
        created: note.created
      }}),{}));
    },
    async hydrate(state) {
      const { sdk } = state.state.dory;
      if (!sdk) return;
      if (state.state.token) {
        Store.commit("setToken", await sdk.refreshToken(state.state.token));
      }
      await state.dispatch("refreshUserModel");
      await state.dispatch("refreshLoginMethods");
      if (!state.state.dory.userModel) return;
      await state.dispatch("refreshNotesFromServer");
    }
  },
  getters: {
    preferredColorScheme: state => {
      return state.preferences.preferredColorScheme;
    },
    backend: state => {
      return state.preferences.backend;
    },
    currentNote: state => {
      return state.notes[state.currentNote];
    },
    currentNoteName: (state, getters) => {
      return getters.currentNote.name;
    },
    currentNoteID: state => {
      return state.currentNote;
    },
    user: state => {
      return state.dory.userModel;
    },
    token: state => {
      return state.token;
    },
    sortedNotes: state => {
      const flatNotes = Object.keys(state.notes).map(k => ({
        id: k,
        ...state.notes[k]
      }));
  
      return flatNotes.sort((a, b) => {
        const aTime = a.updated || a.created;
        const bTime = b.updated || b.created;
        return bTime - aTime;
      });
    },
    nextNote: (state, getters) => {
      const list: Array<Note & {id: string}> = getters.sortedNotes;
      return (
        list[list.findIndex(note => note.id === state.currentNote) + 1] ||
        list[list.findIndex(note => note.id === state.currentNote) - 1]
      );
    },
    prevNote: (state, getters) => {
      const list: Array<Note & {id: string}> = getters.sortedNotes;
      return list[list.findIndex(note => note.id === state.currentNote) - 1];
    },
    shouldDelete: (state, getters) => {
      return getters.sortedNotes.length > 1;
    },
    isAuthenticated: (state) => {
      return !!state.dory.userModel;
    },
    authSDK: (state, getters) => {
      getters
      return getters.isAuthenticated && state.dory.sdk;
    },
    sdk: state => state.dory.sdk,
    socket: state => state.dory.socket,
    permitCollaboration: state => !!state.preferences.enableCollaborationMode,
    rtcEndpoint: state => state.preferences.backend && `ws${IS_SECURE ? "s" : ""}://${location.host}`
  },
  modules: {
  },
  plugins: [vuexLocal.plugin]
});

function initializeSDK() {
  Store.commit("resetSDK");
}

Store.subscribe((mutation, state) => {
  switch (mutation.type) {
  case "setPreference":
    switch (mutation.payload.name) {
    case "backend":
      initializeSDK();
    }
    break;
  default:
    break;
  }
});

initializeSDK();

export default Store;