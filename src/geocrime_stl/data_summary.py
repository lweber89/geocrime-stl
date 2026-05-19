def generate_summary_dashboard(df):
    """Prints a high-level statistical overview of the cleaned dataset."""
    print("==================================================")
    print(f"📊 ST. LOUIS CRIME DATA SUMMARY REPORT")
    print("==================================================")
    print(f"🔹 Total Incident Count: {len(df)}")
    
    print("\n🚨 TOP 5 CRIME CATEGORIES:")
    # Counts unique values in the nibrs_cat column
    top_crimes = df['nibrs_cat'].value_counts().head(5)
    for cat, count in top_crimes.items():
        print(f"  - {cat}: {count} incidents")

    print("\n🔫 WEAPON INVOLVEMENT:")
    if 'firearm' in df.columns:
        firearm_counts = df['firearm'].value_counts()
        # Checks for common naming conventions the SLMPD uses
        yes_count = firearm_counts.get('Y', 0) + firearm_counts.get('Yes', 0)
        print(f"  - Firearm Involved: {yes_count} ({yes_count/len(df):.1%})")
    else:
        print("  - Firearm data unavailable")

    print("\n🏘️ TOP 3 MOST ACTIVE NEIGHBORHOODS (BY COUNT):")
    if 'nbhd' in df.columns:
        top_nbhds = df['nbhd'].value_counts().head(3)
        for nbhd, count in top_nbhds.items():
            print(f"  - {nbhd}: {count} incidents")
            
    print("\n⏰ INCIDENTS BY POLICE DISTRICT:")
    if 'district' in df.columns:
        districts = df['district'].value_counts().sort_index()
        for dist, count in districts.items():
            print(f"  - District {dist}: {count} incidents")
    print("==================================================")