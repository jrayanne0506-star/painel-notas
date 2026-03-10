import { google } from "googleapis"

export const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
})

export const sheets = google.sheets({ version: "v4", auth })
export const drive  = google.drive({ version: "v3", auth })

export const SHEET_ENTREGADORES_ID = process.env.GOOGLE_SHEET_ENTREGADORES_ID!
export const SHEET_NOTAS_ID        = process.env.GOOGLE_SHEET_NOTAS_ID!