// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_long_cerebro.sql';
import m0001 from './0001_public_wind_dancer.sql';
import m0002 from './0002_loose_shooting_star.sql';
import m0003 from './0003_dizzy_falcon.sql';
import m0004 from './0004_row_changes.sql';
import m0005 from './0005_tearful_marauders.sql';
import m0006 from './0006_query_indexes.sql';
import m0007 from './0007_drop_row_changes.sql';
import m0008 from './0008_round_post_timestamps.sql';
import m0009 from './0009_purged_assets.sql';
import m0010 from './0010_outbox_errors.sql';
import m0011 from './0011_outbox_fields.sql';
import m0012 from './0012_purged_files.sql';
import m0013 from './0013_asset_details.sql';
import m0014 from './0014_ai_tables.sql';
import m0015 from './0015_assistant_setup.sql';
import m0016 from './0016_favorites.sql';
import m0017 from './0017_instructions.sql';
import m0018 from './0018_drop_use_emoji.sql';
import m0019 from './0019_drop_persona_draft_instructions.sql';
import m0020 from './0020_app_prompts.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013,
m0014,
m0015,
m0016,
m0017,
m0018,
m0019,
m0020
    }
  }
  