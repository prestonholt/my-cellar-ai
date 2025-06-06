#!/usr/bin/env tsx

import { getTastingNotes } from '../lib/ai/tools/wine-cellar-tools';

async function testTastingNotes() {
  console.log('Testing tasting notes for wine ID 3907074...\n');
  
  try {
    const result = await getTastingNotes({ iWine: '3907074' });
    
    console.log('=== Test Result ===');
    console.log('iWine:', result.iWine);
    console.log('Success:', result.success);
    
    if (result.success && result.wineData) {
      console.log('\n=== Wine Data ===');
      console.log('Title:', result.wineData.title);
      console.log('Producer:', result.wineData.producer);
      console.log('Vintage:', result.wineData.vintage);
      console.log('Region:', result.wineData.region);
      console.log('Varietals:', result.wineData.varietals);
      console.log('Bottle Image URL:', result.wineData.bottleImageUrl);
      
      console.log('\n=== Tasting Notes Analysis ===');
      console.log('Number of tasting notes:', result.wineData.tastingNotes.length);
      console.log('Expected: 77 notes');
      console.log('✓ Count matches:', result.wineData.tastingNotes.length === 77 ? 'YES' : 'NO');
      
      if (result.wineData.tastingNotes.length > 0) {
        console.log('\n=== First Few Notes ===');
        result.wineData.tastingNotes.slice(0, 3).forEach((note, index) => {
          console.log(`Note ${index + 1}:`);
          console.log(`  Date: ${note.date || 'N/A'}`);
          console.log(`  Score: ${note.score || 'N/A'}`);
          console.log(`  Note: ${note.note || 'N/A'}`);
          console.log(`  Reviewer: ${note.reviewer || 'N/A'}`);
          console.log('');
        });
        
        console.log('=== Oldest Note (Last in Array) ===');
        const oldestNote = result.wineData.tastingNotes[result.wineData.tastingNotes.length - 1];
        console.log('Date:', oldestNote.date || 'N/A');
        console.log('Note:', oldestNote.note || 'N/A');
        console.log('Expected to contain: "Yummy. Buttery and delicious"');
        console.log('✓ Contains expected text:', 
          oldestNote.note?.includes('Yummy. Buttery and delicious') ? 'YES' : 'NO');
      }
    } else {
      console.log('\n=== Error/Message ===');
      console.log('Message:', result.message);
      if (result.error) {
        console.log('Error:', result.error);
      }
    }
    
    console.log('\n=== Raw Result (for debugging) ===');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testTastingNotes();