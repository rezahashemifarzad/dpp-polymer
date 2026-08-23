/**
 * app/api/v1/client/me/route.ts
 * -----------------------------------------------------------------------
 * GET /api/v1/client/me — resolves the presented client API key to its
 * identity (company name, country). Used by the B2B Client Portal's
 * key-entry gate to confirm a pasted key is valid and show "Signed in as
 * ..." before loading the purchased-batch list, and available to ERP
 * integrations as a lightweight credential-check endpoint before they
 * bother calling the heavier /api/v1/client/passports.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeClient, clientUnauthorizedResponse } from "@/lib/client-auth";

export async function GET(req: NextRequest) {
  const client = await authorizeClient(req);
  if (!client) {
    return clientUnauthorizedResponse();
  }

  return NextResponse.json({
    success: true,
    data: {
      id: client.id,
      companyName: client.companyName,
      country: client.country,
    },
  });
}
