import { Client } from "@gradio/client";
import { NextResponse } from "next/server";

export async function GET() {
	const response_0 = await fetch("http://localhost:3005/data/previews/image/8397.webp");
	const exampleImage = await response_0.blob();
						
	const client = await Client.connect("http://192.168.0.75:7860/");
	const result = await client.predict("/predict", { 
					image: exampleImage, 		
			model_repo: "SmilingWolf/wd-swinv2-tagger-v3", 		
			general_thresh: 0, 		
			general_mcut_enabled: true, 		
			character_thresh: 0, 		
			character_mcut_enabled: true, 
	});

  return NextResponse.json(result.data);
}