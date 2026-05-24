/**
 * Generates a unique username from a name string.
 * @param {string} name - The user's full name.
 * @param {Model} User - The User model to check for uniqueness.
 * @returns {Promise<string>} - A unique username.
 */
export const generateUniqueUsername = async (name, User) => {
  let baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Remove special characters
    .substring(0, 20); // Limit length

  if (baseUsername.length < 3) {
    baseUsername = "user" + Math.floor(Math.random() * 1000);
  }

  let username = baseUsername;
  let exists = await User.findOne({ username });
  let counter = 1;

  while (exists) {
    username = `${baseUsername}${counter}`;
    exists = await User.findOne({ username });
    counter++;
  }

  return username;
};
