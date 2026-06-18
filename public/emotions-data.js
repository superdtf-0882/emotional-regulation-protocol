/**
 * Three-tier emotion taxonomy for the Feelings Wheel.
 *
 * Tier 1 (core): broad, universal emotions — shown as labeled context,
 *   not directly selectable.
 * Tier 2 (middle): more specific emotions — shown as labeled context.
 * Tier 3 (leaves): the granular, selectable emotions. Up to 3 of these
 *   can be chosen. This is the only clickable tier.
 *
 * Structure follows the standard "core → middle → granular" feelings-wheel
 * pattern widely used in therapeutic contexts (most famously Gloria
 * Willcox's 1982 Feelings Wheel), reorganized here in our own grouping —
 * not a reproduction of any single published wheel's artwork or exact text.
 */

const EMOTION_WHEEL = [
  {
    core: 'Happy',
    middles: [
      { name: 'Optimistic', leaves: ['Inspired', 'Hopeful'] },
      { name: 'Trusting', leaves: ['Intimate', 'Sensitive'] },
      { name: 'Peaceful', leaves: ['Thankful', 'Loving'] },
      { name: 'Powerful', leaves: ['Creative', 'Courageous'] },
      { name: 'Accepted', leaves: ['Respected', 'Valued'] },
      { name: 'Proud', leaves: ['Confident', 'Successful'] },
      { name: 'Interested', leaves: ['Curious', 'Inquisitive'] },
      { name: 'Content', leaves: ['Joyful', 'Free'] },
      { name: 'Playful', leaves: ['Cheeky', 'Aroused'] },
    ],
  },
  {
    core: 'Surprised',
    middles: [
      { name: 'Excited', leaves: ['Eager', 'Energetic'] },
      { name: 'Amazed', leaves: ['Awestruck', 'Astonished'] },
      { name: 'Confused', leaves: ['Perplexed', 'Disillusioned'] },
      { name: 'Startled', leaves: ['Dismayed', 'Shocked'] },
    ],
  },
  {
    core: 'Bad',
    middles: [
      { name: 'Tired', leaves: ['Sleepy', 'Unfocused'] },
      { name: 'Stressed', leaves: ['Overwhelmed', 'Out of control'] },
      { name: 'Busy', leaves: ['Pressured', 'Rushed'] },
      { name: 'Bored', leaves: ['Apathetic', 'Indifferent'] },
    ],
  },
  {
    core: 'Fearful',
    middles: [
      { name: 'Scared', leaves: ['Helpless', 'Frightened'] },
      { name: 'Anxious', leaves: ['Worried', 'Concerned'] },
      { name: 'Insecure', leaves: ['Inadequate', 'Worthless'] },
      { name: 'Weak', leaves: ['Insignificant', 'Inferior'] },
      { name: 'Rejected', leaves: ['Excluded', 'Persecuted'] },
      { name: 'Threatened', leaves: ['Nervous', 'Exposed'] },
    ],
  },
  {
    core: 'Angry',
    middles: [
      { name: 'Let down', leaves: ['Betrayed', 'Resentful'] },
      { name: 'Humiliated', leaves: ['Disrespected', 'Ridiculed'] },
      { name: 'Bitter', leaves: ['Indignant', 'Violated'] },
      { name: 'Mad', leaves: ['Furious', 'Jealous'] },
      { name: 'Aggressive', leaves: ['Provoked', 'Hostile'] },
      { name: 'Frustrated', leaves: ['Infuriated', 'Annoyed'] },
      { name: 'Distant', leaves: ['Withdrawn', 'Numb'] },
      { name: 'Critical', leaves: ['Skeptical', 'Dismissive'] },
    ],
  },
  {
    core: 'Disgusted',
    middles: [
      { name: 'Disapproving', leaves: ['Judgmental', 'Condemning'] },
      { name: 'Uncomfortable', leaves: ['Appalled', 'Revolted'] },
      { name: 'Awful', leaves: ['Nauseated', 'Detesting'] },
      { name: 'Repelled', leaves: ['Horrified', 'Hesitant'] },
    ],
  },
  {
    core: 'Sad',
    middles: [
      { name: 'Hurt', leaves: ['Embarrassed', 'Disappointed'] },
      { name: 'Depressed', leaves: ['Unseen', 'Empty'] },
      { name: 'Guilty', leaves: ['Remorseful', 'Ashamed'] },
      { name: 'Despairing', leaves: ['Grief-stricken', 'Powerless'] },
      { name: 'Vulnerable', leaves: ['Victimized', 'Fragile'] },
      { name: 'Lonely', leaves: ['Isolated', 'Abandoned'] },
    ],
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EMOTION_WHEEL };
}
