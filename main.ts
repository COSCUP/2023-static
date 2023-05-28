import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { GoogleSpreadsheet } from "google-spreadsheet"

const DIST = path.join(__dirname, './dist')

const noop = () => { }

async function getLoadedSpreadsheetDocument() {
  const API_KEY = process.env.SPREADSHEET_API_KEY

  if (!API_KEY) return null

  const SPREADSHEET_ID = '1mioOkTnkXUCuMqQN_07Q-ebB_wHxSGrsozMNTSJfby4'
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID)
  doc.useApiKey(API_KEY)
  try {
    await doc.loadInfo()
    return doc
  } catch (e) {
    console.log(e)
    return null
  }
}

function getRawImageUrl(url: string): string {
  if (url.startsWith('https://drive.google.com/file/d/')) {
    return `https://drive.google.com/uc?export=download&id=${url.split('/')[5]}`
  }

  return url
}

async function downloadImages(images: [string, string][], outputPath: string) {
  await mkdir(outputPath, { recursive: true })
  for (const entry of images) {
    const { data: buffer } = await axios.get<Buffer>(getRawImageUrl(entry[1]), {
      responseType: 'arraybuffer'
    })
    await writeFile(path.join(outputPath, `${entry[0]}.png`), buffer)
  }
}

type SponsorLevelTuple = ['titanium', 'diamond', 'co-organizer', 'gold', 'bronze', 'silver', 'special-thanks', 'friend']
type SponsorLevel = SponsorLevelTuple[number]
type SponsorRowKeys = 'id' | 'level' | 'name:en' | 'name:zh-TW' | 'intro:en' | 'intro:zh-TW' | 'link' | 'image' | 'canPublish'
type SponsorRow = {
  [K in SponsorRowKeys]: K extends 'level'
  ? SponsorLevel
  : K extends 'canPublish'
  ? 'Y' | 'N'
  : string;
}

async function downloadLogoOfSponsors(doc: GoogleSpreadsheet) {
  const sheetId = '178607707'
  const sheet = doc.sheetsById[sheetId]
  const rows = await sheet.getRows() as unknown as SponsorRow[]
  const images = rows
    .filter((r) => {
      return r.canPublish === 'Y' && r.id.length > 0 && r.image.length > 0
    })
    .map((r) => {
      return [r.id, r.image] as [string, string]
    })

  const outputPath = path.join(DIST, 'images', 'sponsor')
  await mkdir(outputPath, { recursive: true })
  await downloadImages(images, outputPath)
}

type SponsorNewsRowKeys = 'sponsorId' |'newsId' | 'description' | 'link' | 'image:vertical' | 'image:horizontal' | 'specialWeight' | 'canPublish'
type SponsorNewsRow = {
  [K in SponsorNewsRowKeys]: K extends 'canPublish'
    ? 'Y' | 'N'
    : string;
}

async function downloadImagesOfSponsorNews(doc: GoogleSpreadsheet) {
  const sheetId = '1344636990'
  const sheet = doc.sheetsById[sheetId]
  const rows = await sheet.getRows() as unknown as SponsorNewsRow[]
  const images = rows
    .filter((r) => {
      return r.canPublish === 'Y' && 
        r.sponsorId.length > 0 && 
        r.newsId.length > 0 && 
        r['image:horizontal'].length > 0 && 
        r['image:vertical'].length > 0
    })
    .flatMap((r) => {
      return [
        [`${r.sponsorId}-${r.newsId}-horizontal`, r['image:horizontal']] as [string, string],
        [`${r.sponsorId}-${r.newsId}-vertical`, r['image:vertical']] as [string, string]
      ]
    })

  const outputPath = path.join(DIST, 'images', 'sponsor-news')
  await mkdir(outputPath, { recursive: true })
  await downloadImages(images, outputPath)
}

async function run() {
  const loadedDoc = await getLoadedSpreadsheetDocument()
  if (loadedDoc === null) {
    console.log('Cannot load the spreadsheet')
    return
  }

  await rm(DIST, { recursive: true, force: true }).catch(noop)
  await downloadLogoOfSponsors(loadedDoc)
  await downloadImagesOfSponsorNews(loadedDoc)
  console.log('Done')
}

run()
