"use server";

import { v4 as uuidv4 } from "uuid";
import { getRedisClient } from "./lib/redis";

// Type definitions
export interface ChallengeData {
  completeText: string;
  displayText: string;
  timestamp: number;
}

// Extremely long and challenging words
const extremelyLongWords = [
  "pneumonoultramicroscopicsilicovolcanoconiosis",
  "supercalifragilisticexpialidocious",
  "antidisestablishmentarianism",
  "floccinaucinihilipilification",
  "hippopotomonstrosesquippedaliophobia",
  "pseudopseudohypoparathyroidism",
  "electroencephalographically",
  "thyroparathyroidectomized",
  "psychoneuroendocrinological",
  "spectrophotofluorometrically",
  "hepaticocholangiogastrostomy",
  "incomprehensibilities",
  "honorificabilitudinitatibus",
  "microspectrophotometrically",
  "extraordinarily",
  "characteristically",
  "enthusiastically",
  "wholeheartedly",
  "simultaneously",
  "coincidentally",
  "independently",
  "internationally",
  "misunderstanding",
  "responsibility",
  "unfortunately",
  "congratulations",
  "particularly",
  "relationships",
  "opportunities",
  "communication",
  "determination",
  "revolutionary",
  "approximately",
  "understanding",
  "organization",
  "considerable",
  "professional",
  "immediately",
  "smiles",
  "squirrel",
  "counterrevolutionaries",
  "incomprehensibleness",
  "uncharacteristically",
  "interdisciplinarity",
  "disproportionately",
  "photosynthetically",
  "telecommunications",
  "indistinguishable",
  "multidisciplinary",
  "entrepreneurship",
  "confidentiality",
  "infrastructural",
  "sustainability",
  "authentication",
  "initialization",
  "functionality",
  "accessibility",
  "cybersecurity",
  "swagger",
];

// In-memory store as fallback for when Redis fails
const inMemoryStore = new Map<string, ChallengeData>();

// Function to remove random letters from a word
function createWordWithMissingLetters(word: string): string {
  // Don't modify very short words
  if (word.length <= 3) return word;

  // For longer words, remove 10-20% of letters
  const numLettersToRemove = Math.max(
    1,
    Math.floor(word.length * (Math.random() * 0.1 + 0.1))
  );

  // Create a copy of the word as an array
  const letters = word.split("");

  // Remove random letters
  for (let i = 0; i < numLettersToRemove; i++) {
    // Don't remove the first or last letter to keep the word recognizable
    const randomIndex = Math.floor(Math.random() * (word.length - 2)) + 1;
    if (letters[randomIndex] !== "_") {
      letters[randomIndex] = "_";
    }
  }

  return letters.join("");
}

// Store a challenge
async function storeChallenge(id: string, data: ChallengeData) {
  try {
    // Try to use Redis
    const redis = await getRedisClient();
    await redis.set(`challenge:${id}`, JSON.stringify(data), { EX: 30 }); // 30 second expiration
    return true;
  } catch (error) {
    console.error("Redis storage failed, using in-memory fallback:", error);
    // Fall back to in-memory storage
    inMemoryStore.set(id, data);

    // Clean up old challenges
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    for (const [key, challenge] of inMemoryStore.entries()) {
      if (challenge.timestamp < thirtySecondsAgo) {
        inMemoryStore.delete(key);
      }
    }

    return false;
  }
}

// Retrieve a challenge
async function getChallenge(id: string): Promise<ChallengeData | null> {
  try {
    // Try to use Redis
    const redis = await getRedisClient();
    const data = await redis.get(`challenge:${id}`);
    if (data) {
      return JSON.parse(data) as ChallengeData;
    }
    return null;
  } catch (error) {
    console.error("Redis retrieval failed, using in-memory fallback:", error);
    // Fall back to in-memory storage
    return inMemoryStore.get(id) || null;
  }
}

// Generate a typing challenge
export async function getTypingChallenge() {
  // Create a copy of the words array to shuffle
  const availableWords = [...extremelyLongWords];

  // Fisher-Yates shuffle algorithm
  for (let i = availableWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableWords[i], availableWords[j]] = [
      availableWords[j],
      availableWords[i],
    ];
  }

  // Take the first 30 words from the shuffled array
  const selectedWords = availableWords.slice(0, 30);
  const completeText = selectedWords.join(" ");

  // Create a version with missing letters
  const modifiedWords = selectedWords.map((word) =>
    createWordWithMissingLetters(word)
  );
  const displayText = modifiedWords.join(" ");

  // Generate a unique ID for this challenge
  const id = uuidv4();

  // Store the challenge data
  const challengeData: ChallengeData = {
    completeText,
    displayText,
    timestamp: Date.now(),
  };

  try {
    // Store the challenge
    await storeChallenge(id, challengeData);
  } catch (error) {
    console.error("Error storing challenge:", error);
    // Continue anyway, as we have the in-memory fallback
  }

  // Return ONLY the challenge ID and display text (with missing letters)
  return {
    id,
    displayText,
  };
}

interface TypingTestSubmission {
  challengeId: string;
  typedText: string;
  wpm: number;
  accuracy: number;
  timeMs: number;
}

// Function to calculate accuracy on the server side
function calculateAccuracy(typedText: string, completeText: string): number {
  let errorCount = 0;
  for (let i = 0; i < typedText.length; i++) {
    if (i >= completeText.length || typedText[i] !== completeText[i]) {
      errorCount++;
    }
  }

  const accuracyValue = Math.max(
    0,
    100 - (errorCount / completeText.length) * 100
  );
  return Math.round(accuracyValue);
}

export async function verifyTypingTest(submission: TypingTestSubmission) {
  // Add a small delay to simulate server processing
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Verify the submission
  const { challengeId, typedText, wpm } = submission;

  try {
    // Get the original challenge
    const challenge = await getChallenge(challengeId);

    if (!challenge) {
      return {
        success: false,
        message: "Challenge not found or expired. Please try again.",
      };
    }

    const { completeText: targetText, timestamp } = challenge;

    // Check if the submission is within the 30-second time limit
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - timestamp) / 1000;

    if (elapsedSeconds > 30) {
      return {
        success: false,
        message:
          "Time limit exceeded. Submissions must be completed within 30 seconds.",
      };
    }

    // Calculate accuracy on the server side
    const serverAccuracy = calculateAccuracy(typedText, targetText);

    // Ensure exact text match
    const exactMatch = typedText === targetText;

    // Check if WPM is at least 500
    const wpmMatch = wpm >= 0;

    // Check if accuracy is at least 80%
    const accuracyMatch = serverAccuracy >= 80;

    console.log("Verification checks:", {
      typedLength: typedText.length,
      targetLength: targetText.length,
      exactMatch,
      wpm,
      wpmMatch: wpm >= 0,
      serverAccuracy,
      accuracyMatch: serverAccuracy >= 80,
    });

    // For this cybersecurity challenge, we accept the submission if it meets our criteria
    if (wpmMatch && accuracyMatch && exactMatch) {
      // Return success with the flag
      return {
        success: true,
        flag: "squ1rrel{guessable}",
      };
    }

    // If any checks fail, return failure
    return {
      success: false,
      message:
        "Verification failed. Make sure you complete the test with at least 500 WPM and 100% accuracy.",
    };
  } catch (error) {
    console.error("Error verifying typing test:", error);
    return {
      success: false,
      message: "An error occurred during verification. Please try again.",
    };
  }
}
