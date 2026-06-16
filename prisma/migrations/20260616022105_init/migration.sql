-- CreateTable
CREATE TABLE "ServiceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "painPoints" TEXT NOT NULL,
    "usps" TEXT NOT NULL,
    "salesObjections" TEXT NOT NULL,
    "toneNotes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceProfileId" TEXT NOT NULL,
    "templateId" TEXT,
    "wpSiteId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'INPUT_COMPLETE',
    "generatedQueries" TEXT,
    "approvedQueries" TEXT,
    "mainPageDraft" TEXT,
    "mainPageApproved" TEXT,
    "articleTopics" TEXT,
    "selectedTopicIds" TEXT,
    "generatedArticles" TEXT,
    "formattedOutput" TEXT,
    "wpPageDraftId" INTEGER,
    "wpArticleDraftIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_serviceProfileId_fkey" FOREIGN KEY ("serviceProfileId") REFERENCES "ServiceProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "acfFieldName" TEXT NOT NULL,
    "diviModuleId" TEXT,
    "contentType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    CONSTRAINT "TemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WPSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "appPasswordEncrypted" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
