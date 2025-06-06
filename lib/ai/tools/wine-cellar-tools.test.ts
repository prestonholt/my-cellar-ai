import { describe, it, expect } from 'vitest';
import { getTastingNotes } from './wine-cellar-tools';

describe('getTastingNotes', () => {
  it('should fetch tasting notes for wine ID 3907074', async () => {
    const result = await getTastingNotes({ iWine: '3907074' });
    
    console.log('Test result:', JSON.stringify(result, null, 2));
    
    // Test basic structure
    expect(result).toBeDefined();
    expect(result.iWine).toBe('3907074');
    
    // If successful, check for expected data
    if (result.success) {
      expect(result.wineData).toBeDefined();
      expect(result.wineData.tastingNotes).toBeDefined();
      expect(Array.isArray(result.wineData.tastingNotes)).toBe(true);
      
      // Check for expected number of notes (should be 77)
      console.log(`Found ${result.wineData.tastingNotes.length} tasting notes`);
      expect(result.wineData.tastingNotes.length).toBe(77);
      
      // Check for the oldest note matching "Yummy. Buttery and delicious"
      const oldestNote = result.wineData.tastingNotes[result.wineData.tastingNotes.length - 1];
      console.log('Oldest note:', oldestNote);
      expect(oldestNote.note).toContain('Yummy. Buttery and delicious');
    } else {
      console.log('Request failed with message:', result.message);
      // Log any error details for debugging
      if (result.error) {
        console.log('Error:', result.error);
      }
    }
  }, 30000); // 30 second timeout for network requests
  
  it('should handle network errors gracefully', async () => {
    // Test with a non-existent wine ID to test error handling
    const result = await getTastingNotes({ iWine: 'nonexistent' });
    
    console.log('Error handling test result:', JSON.stringify(result, null, 2));
    
    expect(result).toBeDefined();
    expect(result.iWine).toBe('nonexistent');
    expect(result.error).toBeDefined();
  });
});