import { Logger, Module } from '@nestjs/common';
import { ArenaModule } from './arena/arena.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CombatModule } from './combat/combat.module.js';
import { importLegacyJson } from './legacy/legacy-json-import.js';
import { RadioModule } from './radio/radio.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ConfigModule } from './shared/config/config.module.js';
import { HttpModule } from './shared/http/http.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { StatsModule } from './stats/stats.module.js';
import { TowerModule } from './tower/tower.module.js';
import { TrainersModule } from './trainers/trainers.module.js';
import { WebRoutesModule } from './web/web-routes.module.js';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    DatabaseModule.forRoot({ afterOpen: (db, dataDir) => importLegacyJson(db, dataDir, new Logger('LegacyImport')) }),
    CombatModule,
    TrainersModule,
    ArenaModule,
    ChatModule,
    RadioModule,
    TowerModule,
    StatsModule,
    RealtimeModule,
    WebRoutesModule,
  ],
})
export class AppModule {}
