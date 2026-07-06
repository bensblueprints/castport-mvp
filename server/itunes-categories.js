// Apple Podcasts' official category/subcategory list (as of 2024).
// Used to validate show category settings and to power the admin dropdown.
const CATEGORIES = {
  'Arts': ['Books', 'Design', 'Fashion & Beauty', 'Food', 'Performing Arts', 'Visual Arts'],
  'Business': ['Careers', 'Entrepreneurship', 'Investing', 'Management', 'Marketing', 'Non-Profit'],
  'Comedy': ['Comedy Interviews', 'Improv', 'Stand-Up'],
  'Education': ['Courses', 'How To', 'Language Learning', 'Self-Improvement'],
  'Fiction': ['Comedy Fiction', 'Drama', 'Science Fiction'],
  'Government': [],
  'History': [],
  'Health & Fitness': ['Alternative Health', 'Fitness', 'Medicine', 'Mental Health', 'Nutrition', 'Sexuality'],
  'Kids & Family': ['Education for Kids', 'Parenting', 'Pets & Animals', 'Stories for Kids'],
  'Leisure': ['Animation & Manga', 'Automotive', 'Aviation', 'Crafts', 'Games', 'Hobbies', 'Home & Garden', 'Video Games'],
  'Music': ['Music Commentary', 'Music History', 'Music Interviews'],
  'News': ['Business News', 'Daily News', 'Entertainment News', 'News Commentary', 'Politics', 'Sports News', 'Tech News'],
  'Religion & Spirituality': ['Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Judaism', 'Religion', 'Spirituality'],
  'Science': ['Astronomy', 'Chemistry', 'Earth Sciences', 'Life Sciences', 'Mathematics', 'Natural Sciences', 'Nature', 'Physics', 'Social Sciences'],
  'Society & Culture': ['Documentary', 'Personal Journals', 'Philosophy', 'Places & Travel', 'Relationships'],
  'Sports': ['Baseball', 'Basketball', 'Cricket', 'Fantasy Sports', 'Football', 'Golf', 'Hockey', 'Rugby', 'Running', 'Soccer', 'Swimming', 'Tennis', 'Volleyball', 'Wilderness', 'Wrestling'],
  'Technology': [],
  'True Crime': [],
  'TV & Film': ['After Shows', 'Film History', 'Film Interviews', 'Film Reviews', 'TV Reviews']
};

const DEFAULT_CATEGORY = 'Technology';

function isValidCategory(cat) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, cat);
}

function isValidSubcategory(cat, sub) {
  if (!sub) return true;
  return isValidCategory(cat) && CATEGORIES[cat].includes(sub);
}

module.exports = { CATEGORIES, DEFAULT_CATEGORY, isValidCategory, isValidSubcategory };
