interface ProjectAvatarProps {
  name: string;
}

const ProjectAvatar = ({ name }: ProjectAvatarProps) => {
  // Array of Tailwind background colors for variety
  const bgColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
  ];

  // Get up to 2 initials from the project name
  const getInitials = (name: string) => {
    const words = name.split(/[\s-_]/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate a consistent color index from the project name
  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % bgColors.length;
  };

  const colorIndex = getColorIndex(name);
  const bgColor = bgColors[colorIndex];
  const initials = getInitials(name);

  return (
    <div className={`${bgColor} w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5`}>
      <span className="text-xs font-medium text-white">{initials}</span>
    </div>
  );
};

export default ProjectAvatar;
