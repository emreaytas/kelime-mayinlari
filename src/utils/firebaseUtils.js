export const cleanFirebaseData = (obj) => {
  if (!obj || typeof obj !== "object") return;

  // Process all keys in the object
  Object.entries(obj).forEach(([key, value]) => {
    // Skip null values
    if (value === null) return;

    // Convert arrays with arrays inside to object maps
    if (Array.isArray(value)) {
      // Check if this array contains other arrays
      if (value.some((item) => Array.isArray(item))) {
        // Convert to object map format
        const mapObject = {};
        value.forEach((item, index) => {
          mapObject[`item_${index}`] = Array.isArray(item)
            ? convertArrayToObject(item)
            : item;
        });
        obj[key] = mapObject;
      } else {
        // Regular array - process each item in the array
        value.forEach((item) => {
          if (item && typeof item === "object") {
            cleanFirebaseData(item);
          }
        });
      }
    }
    // Process nested objects
    else if (typeof value === "object") {
      cleanFirebaseData(value);
    }
  });

  return obj;
};

// Helper function to convert arrays to objects
export const convertArrayToObject = (array) => {
  const obj = {};
  array.forEach((item, index) => {
    obj[`index_${index}`] = item;
  });
  return obj;
};
