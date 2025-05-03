// // for testing/being lazy, remove from prod lol
import { NextResponse } from "next/server";

export async function GET() {
  let rtrn = [''];

  try {
    for (let i = 52; i > 33; i--) {
      const response = await fetch('http://71.64.117.25:3069/api/pools/3/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId: i }),
      });

      if (!response.ok) throw new Error(`Cancelled: ${response}`);

      const p = await response.json();

      rtrn.push(p.postId)
    }
  } catch (err) {
    console.log(err)
  }
  

  return NextResponse.json(rtrn);
}