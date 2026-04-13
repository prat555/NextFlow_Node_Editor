import { ffmpeg } from "@trigger.dev/build/extensions/core"
import { prismaExtension } from "@trigger.dev/build/extensions/prisma"
import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: "proj_fezbmbjxvnbodoingimd",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  dirs: ["./trigger"],
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
      }),
      ffmpeg({ version: "7" }),
    ],
  },
});
