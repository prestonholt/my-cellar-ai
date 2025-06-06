#!/usr/bin/env tsx

// Test just the parsing logic directly

async function testParsingLogic() {
  console.log('Testing tasting notes parsing for wine ID 3907074...\n');
  
  const iWine = '3907074';
  const notesUrl = `https://www.cellartracker.com/notes.asp?iWine=${iWine}`;
  
  try {
    const notesResponse = await fetch(notesUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `https://www.cellartracker.com/wine.asp?iWine=${iWine}`,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!notesResponse.ok) {
      console.log('Failed to fetch notes:', notesResponse.status);
      return;
    }
    
    const notesHtml = await notesResponse.text();
    console.log('HTML length:', notesHtml.length);
    
    // Parse tasting notes using the new logic
    const tastingNotes: Array<{
      date?: string;
      score?: string;
      note?: string;
      reviewer?: string;
    }> = [];
    
    // Method 1: Look for notes with itemprop="reviewBody"
    const reviewBodyMatches = notesHtml.match(/<p[^>]*itemprop=["']reviewBody["'][^>]*>(.*?)<\/p>/gis);
    if (reviewBodyMatches) {
      console.log(`Found ${reviewBodyMatches.length} review body matches`);
      
      for (const reviewMatch of reviewBodyMatches) {
        const noteText = reviewMatch.replace(/<[^>]*>/g, '').trim();
        if (noteText.length > 2) {
          // Try to find associated reviewer and other details by looking backwards in HTML
          const reviewIndex = notesHtml.indexOf(reviewMatch);
          const contextBefore = notesHtml.substring(Math.max(0, reviewIndex - 2000), reviewIndex);
          
          // Look for reviewer name (usually in a span with itemprop="author")
          let reviewer = '';
          const authorMatch = contextBefore.match(/<span[^>]*itemprop=["']author["'][^>]*>([^<]+)<\/span>/i);
          if (authorMatch) {
            reviewer = authorMatch[1].trim();
          }
          
          // Look for score in the context
          let score = '';
          const scoreMatches = contextBefore.match(/(\d{1,3}(?:\.\d{1,2})?)\s*(?:pts?|points?|\/100)?/gi);
          if (scoreMatches && scoreMatches.length > 0) {
            // Take the last score found (most likely to be the right one)
            score = scoreMatches[scoreMatches.length - 1];
          }
          
          // Look for date
          let date = '';
          const dateMatches = contextBefore.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
          if (dateMatches && dateMatches.length > 0) {
            date = dateMatches[dateMatches.length - 1];
          }
          
          tastingNotes.push({
            date: date || undefined,
            score: score || undefined,
            note: noteText,
            reviewer: reviewer || undefined,
          });
        }
      }
    }
    
    // Method 2: Fallback - look for div structures (backup method)
    if (tastingNotes.length === 0) {
      console.log('No structured notes found, trying alternative parsing...');
      
      // Look for any text that might be tasting notes
      const possibleNotes = notesHtml.match(/<p[^>]*class=["'][^"']*break_word[^"']*["'][^>]*>(.*?)<\/p>/gis);
      if (possibleNotes) {
        for (const noteMatch of possibleNotes) {
          const noteText = noteMatch.replace(/<[^>]*>/g, '').trim();
          if (noteText.length > 10 && !noteText.includes('Do you find this review helpful')) {
            tastingNotes.push({
              note: noteText,
            });
          }
        }
      }
    }
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Total notes extracted: ${tastingNotes.length}`);
    console.log(`Expected: 77 notes`);
    console.log(`✓ Count matches: ${tastingNotes.length === 77 ? 'YES' : 'NO'}`);
    
    if (tastingNotes.length > 0) {
      console.log(`\n=== First 3 Notes ===`);
      tastingNotes.slice(0, 3).forEach((note, index) => {
        console.log(`Note ${index + 1}:`);
        console.log(`  Date: ${note.date || 'N/A'}`);
        console.log(`  Score: ${note.score || 'N/A'}`);
        console.log(`  Reviewer: ${note.reviewer || 'N/A'}`);
        console.log(`  Note: ${note.note || 'N/A'}`);
        console.log('');
      });
      
      console.log(`=== Last Note (should be oldest) ===`);
      const lastNote = tastingNotes[tastingNotes.length - 1];
      console.log(`Date: ${lastNote.date || 'N/A'}`);
      console.log(`Reviewer: ${lastNote.reviewer || 'N/A'}`);
      console.log(`Note: ${lastNote.note || 'N/A'}`);
      console.log(`✓ Contains "Yummy. Buttery and delicious": ${lastNote.note?.includes('Yummy. Buttery and delicious') ? 'YES' : 'NO'}`);
      
      // Look for the specific note in any position
      const yummyNote = tastingNotes.find(note => note.note?.includes('Yummy. Buttery and delicious'));
      if (yummyNote) {
        console.log(`\n=== Found "Yummy" Note ===`);
        console.log(`Position: ${tastingNotes.indexOf(yummyNote) + 1} of ${tastingNotes.length}`);
        console.log(`Date: ${yummyNote.date || 'N/A'}`);
        console.log(`Reviewer: ${yummyNote.reviewer || 'N/A'}`);
        console.log(`Note: ${yummyNote.note || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testParsingLogic();