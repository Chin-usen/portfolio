import { describe, it } from 'vitest';
import { createMathChecks } from './rv-reducer-math.checks';
import { RV_DEFAULT_PARAMETERS } from '../../src/components/lab/rv-reducer/params';
describe('RV mathematical geometry and two-stage kinematics', () => {
  for (const check of createMathChecks(RV_DEFAULT_PARAMETERS))
    it(
      check.name,
      () => {
        check.run();
      },
      30_000,
    );
});
