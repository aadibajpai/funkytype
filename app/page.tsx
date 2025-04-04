"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Clock,
  HelpCircle,
  Music,
  RefreshCw,
  Trophy,
  Unlock,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTypingChallenge, verifyTypingTest } from "./actions";
import Confetti from "./components/confetti";

export default function Home() {
  const [text, setText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [completeText, setCompleteText] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errors, setErrors] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [theme, setTheme] = useState("funky");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flag, setFlag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [challengeStartTime, setChallengeStartTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const activeCharRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch typing challenge from the server
  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const challenge = await getTypingChallenge();
      setDisplayText(challenge.displayText);
      setChallengeId(challenge.id);
      const now = Date.now();
      setChallengeStartTime(now);
      setTimeLeft(30);
    } catch (error) {
      console.error("Failed to fetch typing challenge:", error);
      setErrorMessage("Failed to load challenge. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize the challenge
  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  // Timer for the 30-second limit
  useEffect(() => {
    if (challengeStartTime > 0 && !isFinished) {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Start a new timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - challengeStartTime) / 1000);
        const remaining = Math.max(0, 30 - elapsed);
        setTimeLeft(remaining);

        // Auto-submit if time runs out
        if (remaining === 0 && !isFinished) {
          clearInterval(timerRef.current!);
          if (isStarted) {
            finishTest();
          } else {
            // If they never started typing, just reset
            resetTest();
          }
        }
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [challengeStartTime, isFinished, isStarted]);

  useEffect(() => {
    if (isStarted && !isFinished) {
      const interval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000 / 60; // in minutes
        const wordsTyped = text.trim().split(/\s+/).length;
        const currentWpm = Math.round(wordsTyped / elapsedTime);
        setWpm(currentWpm);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isStarted, isFinished, startTime, text]);

  // Scroll to active character
  useEffect(() => {
    if (activeCharRef.current && textDisplayRef.current) {
      const container = textDisplayRef.current;
      const element = activeCharRef.current;

      // Calculate the position of the element relative to the container
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // If the element is outside the visible area, scroll to it
      if (
        elementRect.bottom > containerRect.bottom ||
        elementRect.top < containerRect.top
      ) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [text]);

  // Estimate accuracy client-side (actual verification happens server-side)
  const estimateAccuracy = (inputValue: string) => {
    // Since we don't have the complete text, we can only estimate accuracy
    // based on non-underscore characters in the display text
    let errorCount = 0;
    let totalNonUnderscoreChars = 0;

    for (let i = 0; i < Math.min(inputValue.length, displayText.length); i++) {
      if (displayText[i] !== "_") {
        totalNonUnderscoreChars++;
        if (inputValue[i] !== displayText[i]) {
          errorCount++;
        }
      }
    }

    // Add penalty for length mismatch
    if (inputValue.length > displayText.length) {
      errorCount += inputValue.length - displayText.length;
    }

    // Estimate accuracy - this is just for UI feedback
    // The server will calculate the actual accuracy
    const totalChars = Math.max(displayText.length, inputValue.length);
    const accuracyValue = Math.max(0, 100 - (errorCount / totalChars) * 100);
    return Math.round(accuracyValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isStarted) {
      setIsStarted(true);
      setStartTime(Date.now());
    }

    const inputValue = e.target.value;
    // Only accept input up to the display text length
    const truncatedValue = inputValue;
    setText(truncatedValue);

    // Estimate accuracy (actual verification happens server-side)
    const estimatedAccuracy = estimateAccuracy(truncatedValue);
    setAccuracy(estimatedAccuracy);

    // Estimate errors
    setErrors(
      Math.round(((100 - estimatedAccuracy) * displayText.length) / 100)
    );

    // Check if test is complete based on total length including underscores
    const nonUnderscoreLength = displayText
      .split("")
      .filter((char) => char !== "_").length;
    const underscoreLength = displayText
      .split("")
      .filter((char) => char === "_").length;
    const totalRequiredLength = nonUnderscoreLength + underscoreLength;

    // Only finish if we have the complete text AND this isn't a backspace
    if (
      truncatedValue.length >= totalRequiredLength &&
      inputValue.length >= truncatedValue.length
    ) {
      // Pass the final text value directly
      setTimeout(() => finishTest(truncatedValue), 0);
    }
  };

  const finishTest = (finalText?: string) => {
    if (isFinished) return;

    setIsFinished(true);
    const endTimeValue = Date.now();
    setEndTime(endTimeValue);
    const finalWpm = Math.round(
      (finalText || text).trim().split(/\s+/).length /
        ((endTimeValue - startTime) / 1000 / 60)
    );
    setWpm(finalWpm);

    if (finalWpm >= 500) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Automatically submit the results with the final text
    submitResults(endTimeValue, finalText);
  };

  const resetTest = () => {
    setText("");
    setIsStarted(false);
    setIsFinished(false);
    setStartTime(0);
    setEndTime(0);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    setShowConfetti(false);
    setFlag(null);
    setErrorMessage(null);
    setShowHelp(false);

    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    fetchChallenge();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const submitResults = async (endTimeValue: number, finalText?: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    const textToSubmit = finalText || text;
    try {
      const result = await verifyTypingTest({
        challengeId,
        typedText: textToSubmit,
        wpm,
        accuracy, // Server will recalculate this anyway
        timeMs: endTimeValue - startTime,
      });

      if (result.success) {
        setFlag(result.flag);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      } else if (result.message) {
        setErrorMessage(result.message);
      }
    } catch (error) {
      console.error("Failed to submit results:", error);
      setErrorMessage("Failed to submit results. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getThemeClass = () => {
    switch (theme) {
      case "funky":
        return "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400";
      case "neon":
        return "bg-gradient-to-br from-green-400 via-cyan-500 to-blue-500";
      case "retro":
        return "bg-gradient-to-br from-amber-500 via-orange-500 to-red-500";
      default:
        return "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400";
    }
  };

  // Render the text with proper highlighting
  const renderText = () => {
    if (!displayText) return null;

    // Process the text to ensure proper word wrapping
    // Split the text into words
    const displayWords = displayText.split(" ");

    return (
      <div className="text-xl font-mono">
        {displayWords.map((displayWord, wordIndex) => {
          // Calculate approximate position in the text
          const wordStart = displayText.indexOf(
            displayWord,
            wordIndex > 0
              ? displayText.indexOf(displayWords[wordIndex - 1]) +
                  displayWords[wordIndex - 1].length +
                  1
              : 0
          );

          return (
            <span key={wordIndex} className="inline-block mr-2 mb-2">
              {displayWord.split("").map((displayChar, charIndex) => {
                const absoluteIndex = wordStart + charIndex;

                // Determine character state based on what we can see
                let state = "upcoming"; // Default state

                if (absoluteIndex < text.length) {
                  // For visible characters, we can check if they match
                  // For underscores, we can't know if they're correct until server verification
                  state =
                    displayChar !== "_" && text[absoluteIndex] === displayChar
                      ? "correct"
                      : "incorrect";
                }

                // Determine if this is the active character (next to be typed)
                const isActive = absoluteIndex === text.length;

                // Special styling for missing letters (underscores)
                const isMissingLetter = displayChar === "_";

                return (
                  <span
                    key={charIndex}
                    ref={isActive ? activeCharRef : null}
                    className={cn(
                      "transition-colors",
                      isMissingLetter
                        ? "border-b-2 border-dashed border-white/50"
                        : "",
                      isMissingLetter
                        ? "text-white/40"
                        : // Make underscores more subtle
                        state === "correct"
                        ? "text-green-400"
                        : state === "incorrect"
                        ? "text-red-400"
                        : "text-white/80",
                      isActive &&
                        "bg-white/20 border-b-2 border-white animate-pulse"
                    )}
                  >
                    {displayChar}
                  </span>
                );
              })}
              {wordIndex < displayWords.length - 1 && (
                <span
                  className={cn(
                    "transition-colors",
                    wordStart + displayWord.length < text.length
                      ? text[wordStart + displayWord.length] === " "
                        ? "text-green-400"
                        : "text-red-400"
                      : "text-white/80",
                    wordStart + displayWord.length === text.length &&
                      "bg-white/20 border-b-2 border-white animate-pulse"
                  )}
                >
                  {" "}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-4 transition-colors",
        getThemeClass()
      )}
    >
      {showConfetti && <Confetti />}

      <div
        className="w-full max-w-3xl flex flex-col items-center gap-6"
        key="funkytype-main-container"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-8 w-8 text-white" />
          <h1 className="text-4xl font-bold text-white tracking-tight">
            FunkyType
          </h1>
        </div>

        <Card className="w-full bg-black/40 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className="bg-white/10 text-white border-none"
                >
                  WPM: {wpm}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white/10 text-white border-none"
                >
                  Accuracy: {accuracy}%
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-white hover:bg-white/20"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Badge
                  variant="outline"
                  className={cn(
                    "bg-black/30 border-none flex items-center gap-1",
                    timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"
                  )}
                >
                  <Clock className="h-3 w-3" /> {timeLeft}s
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => resetTest()}
                  className="text-white hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showHelp && (
              <div className="mb-4 p-3 bg-black/30 rounded-lg text-white/90 text-sm">
                <p className="font-bold mb-1">Challenge Mode:</p>
                <p>
                  Some letters are missing (shown as "_"). You must guess and
                  type the complete words correctly.
                </p>
              </div>
            )}

            <div className="relative mb-4">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white/80">Loading challenge...</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={textDisplayRef}
                  className="h-64 overflow-y-auto p-4 bg-black/20 rounded-lg leading-relaxed"
                >
                  {renderText()}
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleInputChange}
                className="absolute opacity-0 top-0 left-0 w-full h-full cursor-default"
                autoFocus
                disabled={isFinished || isLoading || timeLeft === 0}
              />
            </div>

            <Progress
              value={(text.length / displayText.length) * 100}
              className="h-2 bg-white/20"
            />

            {errorMessage && !isFinished && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
                <p className="text-red-300">{errorMessage}</p>
              </div>
            )}

            {isFinished && (
              <div className="mt-6 p-4 bg-white/10 rounded-lg">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5" /> Results
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/60 text-sm">WPM</p>
                    <p className="text-white text-2xl font-bold">{wpm}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Accuracy</p>
                    <p className="text-white text-2xl font-bold">{accuracy}%</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Errors</p>
                    <p className="text-white text-2xl font-bold">{errors}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Time</p>
                    <p className="text-white text-2xl font-bold">
                      {((endTime - startTime) / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>

                {wpm >= 500 ? (
                  <div className="mt-4 p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg text-center">
                    <p className="text-black font-bold">
                      🎉 AMAZING! You reached 500+ WPM! 🎉
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-white/10 rounded-lg text-center">
                    <p className="text-white/80">
                      Keep practicing! You need {500 - wpm} more WPM to reach
                      the goal.
                    </p>
                  </div>
                )}

                {isSubmitting ? (
                  <div className="mt-4 p-4 bg-white/10 rounded-lg flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-white">Verifying your submission...</p>
                    </div>
                  </div>
                ) : errorMessage ? (
                  <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <p className="text-red-300">{errorMessage}</p>
                    <Button
                      onClick={resetTest}
                      className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : flag ? (
                  <div className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
                      <Unlock className="h-5 w-5" />
                      <span>Flag Unlocked!</span>
                    </div>
                    <p className="font-mono bg-black/30 p-2 rounded text-green-400 break-all">
                      {flag}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-white/10 rounded-lg text-center">
                    <Button
                      onClick={resetTest}
                      className="w-full bg-white/20 hover:bg-white/30 text-white"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="theme" className="w-full max-w-md">
          <TabsList className="grid grid-cols-1 bg-black/40 backdrop-blur-md border-white/20">
            <TabsTrigger
              value="theme"
              className="text-white data-[state=active]:bg-white/20"
            >
              <Music className="h-4 w-4 mr-2" /> Theme
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="theme"
            className="bg-black/40 backdrop-blur-md border-white/20 p-4 rounded-md mt-2"
          >
            <div className="grid grid-cols-3 gap-2">
              {["funky", "neon", "retro"].map((themeName) => (
                <Button
                  key={themeName}
                  variant={theme === themeName ? "default" : "outline"}
                  onClick={() => {
                    setTheme(themeName);
                    // Ensure focus returns to the input after theme change
                    setTimeout(() => {
                      if (inputRef.current && !isFinished && !isLoading) {
                        inputRef.current.focus();
                      }
                    }, 0);
                  }}
                  className={cn(
                    "border-white/20",
                    theme === themeName
                      ? themeName === "funky"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500"
                        : themeName === "neon"
                        ? "bg-gradient-to-r from-green-400 to-blue-500"
                        : "bg-gradient-to-r from-amber-500 to-red-500"
                      : "bg-black/40 text-white hover:text-white hover:bg-white/20"
                  )}
                >
                  {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-white/80 text-center text-sm">
          Challenge: Type at 500+ WPM to unlock the flag! 🚀
        </p>
      </div>
    </main>
  );
}
