// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './0000_long_cerebro.sql';
import m0001 from './0001_public_wind_dancer.sql';
import m0002 from './0002_loose_shooting_star.sql';
import m0003 from './0003_dizzy_falcon.sql';
import m0004 from './0004_row_changes.sql';
import m0005 from './0005_tearful_marauders.sql';
import journal from './meta/_journal.json';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
  },
};
