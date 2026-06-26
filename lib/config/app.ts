import { ENV } from "./env";

const APP_CONFIG = {

  app: {

    name: ENV.APP_NAME,

    version: "0.4.0",

  },

  project: {

    shortName: "IRM",

    timezone: ENV.TIMEZONE,

    defaultLanguage: ENV.DEFAULT_LANGUAGE,

  },

};

export default APP_CONFIG;