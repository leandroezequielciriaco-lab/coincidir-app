export const ACTIVITY_IMAGES = {
  running: [
    require('../assets/images/activities/running-1.png'),
    require('../assets/images/activities/running-2.png'),
    require('../assets/images/activities/running-3.png'),
  ],

  mateada: [
    require('../assets/images/activities/mateada-1.png'),
    require('../assets/images/activities/mateada-2.png'),
    require('../assets/images/activities/mateada-3.png'),
  ],
};

export const getActivityImage = (category?: string) => {
  const normalizedCategory = category?.trim().toLowerCase();

  const images =
    ACTIVITY_IMAGES[
      normalizedCategory as keyof typeof ACTIVITY_IMAGES
    ];

  if (images && images.length > 0) {
    return images[Math.floor(Math.random() * images.length)];
  }

  return require('../assets/images/activities/running-1.png');
};
