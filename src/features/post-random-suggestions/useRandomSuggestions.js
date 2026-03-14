import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useState, useMemo } from 'react';

import sendAiMessageAsync from '@/features/ai-suggestions/sendAiMessageAsync';
import {
  DEFAULT_MODEL,
  DEFAULT_RANDOM_TWEETS_PROMPT,
  MODEL_STORAGE_KEY,
  RANDOM_TWEETS_PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  DEFAULT_SYSTEM_PROMPT,
} from '@/features/ai-suggestions/aiSuggestionsStorage';
import useAssets from '@/features/assets-context/useAssets';

const TWEET_BATCH_SIZE = 10;
const ASSET_BATCH_SIZE = 20;
const BATCH_INSTRUCTION = `Generate exactly ${TWEET_BATCH_SIZE} tweets and return them as a raw JSON array of strings. Nothing else.`;

export default function useRandomSuggestions({ recentPostTexts }) {
  const { assets } = useAssets();
  const tweetsRef = useRef([]);
  const tweetIndexRef = useRef(0);
  const assetPoolRef = useRef([]);
  const assetIndexRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);

  const { favoriteAssets, nonFavoriteAssets } = useMemo(() => {
    const assetList = Object.values(assets ?? {}).filter((a) => !a.isDeleted);
    return {
      favoriteAssets: assetList.filter((a) => a.isFavorite),
      nonFavoriteAssets: assetList.filter((a) => !a.isFavorite),
    };
  }, [assets]);

  async function fetchTweetBatch() {
    const [storedPrompt, storedModel, storedSystemPrompt] = await Promise.all([
      AsyncStorage.getItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY),
      AsyncStorage.getItem(MODEL_STORAGE_KEY),
      AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
    ]);

    const stylePrompt = (storedPrompt ?? DEFAULT_RANDOM_TWEETS_PROMPT).trim();
    const model = storedModel ?? DEFAULT_MODEL;
    const systemPrompt = storedSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const fullPrompt = `${BATCH_INSTRUCTION}\n\n${stylePrompt}`;

    const tweets = await sendAiMessageAsync(
      [{ role: 'user', content: fullPrompt }],
      recentPostTexts,
      model,
      systemPrompt || null,
    );

    tweetsRef.current = tweets;
    tweetIndexRef.current = 0;
  }

  function buildAssetPool() {
    if (favoriteAssets.length === 0 && nonFavoriteAssets.length === 0) return;

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pool = [];

    for (let i = 0; i < ASSET_BATCH_SIZE; i++) {
      let asset;
      if (favoriteAssets.length === 0) asset = pick(nonFavoriteAssets);
      else if (nonFavoriteAssets.length === 0) asset = pick(favoriteAssets);
      else asset = i % 2 === 0 ? pick(favoriteAssets) : pick(nonFavoriteAssets);
      pool.push(asset);
    }

    assetPoolRef.current = pool;
    assetIndexRef.current = 0;
  }

  async function getNextTweet() {
    setIsLoading(true);
    try {
      if (tweetIndexRef.current >= tweetsRef.current.length) {
        await fetchTweetBatch();
      }
      const tweet = tweetsRef.current[tweetIndexRef.current];
      tweetIndexRef.current += 1;
      return tweet ?? null;
    } finally {
      setIsLoading(false);
    }
  }

  function getNextAsset() {
    if (assetIndexRef.current >= assetPoolRef.current.length) {
      buildAssetPool();
    }
    if (assetPoolRef.current.length === 0) return null;
    const asset = assetPoolRef.current[assetIndexRef.current];
    assetIndexRef.current += 1;
    return asset ?? null;
  }

  return { getNextTweet, getNextAsset, isLoading };
}
