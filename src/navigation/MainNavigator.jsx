import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "../screens/HomeScreen";
import GameScreen from "../screens/GameScreen";
import ActiveGamesScreen from "../screens/ActiveGamesScreen";
import CompletedGamesScreen from "../screens/CompletedGamesScreen";

const Stack = createStackNavigator();

const MainNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Game" component={GameScreen} />
      <Stack.Screen name="ActiveGames" component={ActiveGamesScreen} />
      <Stack.Screen name="CompletedGames" component={CompletedGamesScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
