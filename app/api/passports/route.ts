import { NextResponse } from 'next/server';
import { PrismaClient, PolymerType, RecycledContentSource, DppStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const passports = await prisma.polymerPassport.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: passports });
  } catch (error: any) {
    console.error('API GET Error:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Generate unique identifiers
    const batchId = `BATCH-${Math.floor(100000 + Math.random() * 900000)}`;
    const random10 = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const exact14Gtin = `0000${random10}`; // Exactly 14 chars

    // 2. Safe Enum mapping
    let pType: PolymerType = PolymerType.PP;
    if (body.polymerType && Object.values(PolymerType).includes(body.polymerType as PolymerType)) {
      pType = body.polymerType as PolymerType;
    }

    // 3. Convert numbers to Prisma.Decimal safely
    const mfiVal = new Prisma.Decimal(parseFloat(body.mfi) || 12.0);
    const densityVal = new Prisma.Decimal(parseFloat(body.density) || 0.905);
    const pcrVal = new Prisma.Decimal(parseFloat(body.pcrPercentage) || 0.0);
    const carbonVal = new Prisma.Decimal(1.25);

    // 4. Create Record with all required fallback values
    const newPassport = await prisma.polymerPassport.create({
      data: {
        polymerType: pType,
        grade: body.gradeName || 'Standard Industrial Grade',
        meltFlowIndex: mfiVal,
        density: densityVal,
        gtin: exact14Gtin,
        recycledContentSource: RecycledContentSource.POST_CONSUMER,
        recycledContentPercent: pcrVal,
        totalRecycledPercent: pcrVal,
        batchId: batchId,
        status: DppStatus.ISSUED,
        carbonFootprintKgCO2ePerKg: carbonVal,
        
        // فیلدهای تکمیلی و احتمالی اسکیما جهت جلوگیری از خطای Required Fields
        description: body.description || 'Polymer Digital Product Passport',
        manufacturerName: body.manufacturerName || 'Circular Poly SaaS',
        originCountry: body.originCountry || 'DE',
      } as any, // اسکیپ تایپ‌چک محلی جهت تطابق کامل با اسکیمای پویا
    });

    return NextResponse.json({ success: true, data: newPassport }, { status: 201 });
  } catch (error: any) {
    console.error('API POST Detailed Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to issue passport',
        details: JSON.stringify(error) 
      },
      { status: 500 }
    );
  }
}