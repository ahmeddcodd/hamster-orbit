import type { HazardDef } from '../levels/types';
import type { HazardContext } from './Hazard';
import { Hazard } from './Hazard';
import { MovingPlatform, RotatingPlatform, TiltingPlatform } from './platforms';
import { Bumper, FanField, LaunchRamp, SpeedBooster } from './kinetic';
import { Crusher, FlickerBridge, SawBlade, SwingingHammer } from './timing';
import { BreakableGlass, EnemyBall, MagnetWall, TransportTube } from './special';

export function buildHazard(def: HazardDef, ctx: HazardContext): Hazard {
  switch (def.t) {
    case 'moving':
      return new MovingPlatform(def.id, ctx, def.p, def.s, def.axis, def.dist, def.period, def.offset);
    case 'rotor':
      return new RotatingPlatform(def.id, ctx, def.p, def.s, def.speed);
    case 'tilting':
      return new TiltingPlatform(def.id, ctx, def.p, def.s, def.maxTilt);
    case 'bumper':
      return new Bumper(def.id, ctx, def.p, def.r, def.power);
    case 'enemy':
      return new EnemyBall(def.id, ctx, def.p, def.range, def.speed);
    case 'fan':
      return new FanField(def.id, ctx, def.p, def.s, def.dir, def.strength);
    case 'flicker':
      return new FlickerBridge(def.id, ctx, def.p, def.s, def.period, def.offset);
    case 'boost':
      return new SpeedBooster(def.id, ctx, def.p, def.yaw, def.s, def.power);
    case 'launch':
      return new LaunchRamp(def.id, ctx, def.p, def.yaw, def.s, def.power, def.upPower);
    case 'tube':
      return new TransportTube(def.id, ctx, def.points, def.r, def.speed);
    case 'glass':
      return new BreakableGlass(def.id, ctx, def.p, def.s, def.breakSpeed);
    case 'magnetwall':
      return new MagnetWall(def.id, ctx, def.c, def.r, def.h, def.a0, def.a1);
    case 'crusher':
      return new Crusher(def.id, ctx, def.p, def.s, def.rise, def.period, def.offset);
    case 'hammer':
      return new SwingingHammer(def.id, ctx, def.p, def.len, def.yaw, def.period, def.offset);
    case 'saw':
      return new SawBlade(def.id, ctx, def.p, def.axis, def.travel, def.period, def.r, def.offset);
  }
}
