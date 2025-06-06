#!/usr/bin/env tsx

// Direct test of CellarTracker scraping without database dependencies

async function testCellarTrackerScraping() {
  console.log('Testing CellarTracker scraping for wine ID 3907074...\n');
  
  const iWine = '3907074';
  
  try {
    // Test the main wine page
    console.log('=== Testing Wine Page ===');
    const wineUrl = `https://www.cellartracker.com/wine.asp?iWine=${iWine}`;
    console.log('URL:', wineUrl);
    
    const wineResponse = await fetch(wineUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log('Wine page status:', wineResponse.status);
    console.log('Wine page headers:', Object.fromEntries(wineResponse.headers.entries()));
    
    if (wineResponse.ok) {
      const wineHtml = await wineResponse.text();
      console.log('Wine page HTML length:', wineHtml.length);
      
      // Extract basic wine info
      const titleMatch = wineHtml.match(/<title>([^<]+)<\/title>/i);
      console.log('Page title:', titleMatch ? titleMatch[1] : 'Not found');
    } else {
      console.log('Wine page failed with status:', wineResponse.status);
    }
    
    // Test the tasting notes page
    console.log('\n=== Testing Tasting Notes Page ===');
    const notesUrl = `https://www.cellartracker.com/notes.asp?iWine=${iWine}`;
    console.log('URL:', notesUrl);
    
    const notesResponse = await fetch(notesUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': wineUrl,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log('Notes page status:', notesResponse.status);
    console.log('Notes page headers:', Object.fromEntries(notesResponse.headers.entries()));
    
    if (notesResponse.ok) {
      const notesHtml = await notesResponse.text();
      console.log('Notes page HTML length:', notesHtml.length);
      
      // Try to extract tasting notes
      console.log('\n=== Analyzing Notes Content ===');
      
      // Look for common patterns in CellarTracker notes pages
      const tableRows = notesHtml.match(/<tr[^>]*>.*?<\/tr>/gi) || [];
      console.log('Found table rows:', tableRows.length);
      
      // Look for note content patterns
      const noteMatches = notesHtml.match(/Yummy\. Buttery and delicious/gi) || [];
      console.log('Found "Yummy. Buttery and delicious":', noteMatches.length > 0 ? 'YES' : 'NO');
      
      // Look for date patterns (common in tasting notes)
      const dateMatches = notesHtml.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
      console.log('Found date patterns:', dateMatches.length);
      
      // Look for score patterns (points out of 100)
      const scoreMatches = notesHtml.match(/\b\d{2,3}\s*(?:pts?|points?)?\b/gi) || [];
      console.log('Found score patterns:', scoreMatches.length);
      
      // Save a portion of the HTML for analysis
      console.log('\n=== Sample HTML (first 1000 chars) ===');
      console.log(notesHtml.substring(0, 1000));
      
      console.log('\n=== Sample HTML (around "Yummy" if found) ===');
      const yummyIndex = notesHtml.toLowerCase().indexOf('yummy');
      if (yummyIndex >= 0) {
        const start = Math.max(0, yummyIndex - 200);
        const end = Math.min(notesHtml.length, yummyIndex + 300);
        console.log(notesHtml.substring(start, end));
      } else {
        console.log('Text "yummy" not found in HTML');
      }
      
    } else {
      console.log('Notes page failed with status:', notesResponse.status);
      const responseText = await notesResponse.text();
      console.log('Response text (first 500 chars):', responseText.substring(0, 500));
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testCellarTrackerScraping();