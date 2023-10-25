# Freshdesk Widget

Freshdesk Integration for the PBX Widget.

## Requirements
[Widget Server](https://sc01.brekeke.com:52398/us/pbx-integration/zendesk/-/tree/server)

## Usage

1. Development
   - Install the [FDK CLI](https://developers.freshworks.com/docs/app-sdk/v2.3/freshdesk/app-development-process/#install-the-fdk-+-cli)
   - Update the widgetUrl key in [zcli.apps.config.json](public/zcli.apps.config.json) file with your development/test widget server's URL.
   - Run the command `fdk run` to start the development server.
2. Production
   - Run the command `fdk pack` to build the Freshdesk installer.
   - The installer zip file will be in the directory `dist`.

## Install in Freshdesk

- Navigate to your Freshworks Developer Portal.
- ![1 select developer portal.png](docs/images/1%20select%20developer%20portal.png)
- Select the New App Button
- ![2 select new app.png](docs/images/2%20select%20new%20app.png)
- Select Custom app, type in app name, upload installer and proceed.
- ![3 select custom app.png](docs/images/3%20select%20custom%20app.png)
- Fill the required fields, upload [icon](docs/images/icon.png), then save and publish.
- ![4 app configure.png](docs/images/4%20app%20configure.png)
- Go to Marketplace => Manage Apps => Custom Apps, and the app should be available for installation
- ![5 app available.png](docs/images/5%20app%20available.png)
- Click on install, and fill the widget url field with your Widget Server's URL, DO NOT CHANGE Domain name and API key fields as they are auto populated.
- ![6 app settings.png](docs/images/6%20app%20settings.png)
- Install then refresh the dashboard, the app should now be available in your sidebar.
- ![7 app available.png](docs/images/7%20app%20available.png)
