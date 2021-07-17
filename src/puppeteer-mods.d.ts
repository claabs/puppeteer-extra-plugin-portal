/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable import/no-extraneous-dependencies */
// Extend Puppeteer interfaces transparently to the end user.

// Note, we need to manually copy this file into the build dir (yarn ambient-dts): https://stackoverflow.com/questions/56018167
// Note2: It's not sufficient to just copy over this d.ts file, it needs to be referenced by another .ts file!
// Note3: To make it even more urgh the TS compiler will change the reference import path, hence we need to fix that in the end as well

// This import statement is important for all this to work, otherwise we don't extend but replace the puppeteer module definition.
// https://github.com/microsoft/TypeScript/issues/10859
import {} from 'puppeteer';

import { PortalPluginPageAdditions } from './types';

declare module 'puppeteer' {
  interface Page extends PortalPluginPageAdditions {}
  interface Frame extends PortalPluginPageAdditions {}
}

declare module 'puppeteer-core' {
  interface Page extends PortalPluginPageAdditions {}
  interface Frame extends PortalPluginPageAdditions {}
}
